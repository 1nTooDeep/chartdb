import React, { useCallback, useMemo, useEffect, useState } from 'react';
import type { ExportImageContext, ImageType } from './export-image-context';
import { exportImageContext } from './export-image-context';
import { toJpeg, toPng, toSvg } from 'html-to-image';
import { useReactFlow, getNodesBounds } from '@xyflow/react';
import { useChartDB } from '@/hooks/use-chartdb';
import { useFullScreenLoader } from '@/hooks/use-full-screen-spinner';
import { useTheme } from '@/hooks/use-theme';
import logoDark from '@/assets/logo-dark.png';
import logoLight from '@/assets/logo-light.png';
import type { EffectiveTheme } from '../theme-context/theme-context';

const PADDING = 50; // Padding around the diagram content

export const ExportImageProvider: React.FC<React.PropsWithChildren> = ({
    children,
}) => {
    const { hideLoader, showLoader } = useFullScreenLoader();
    const { setNodes, getNodes } = useReactFlow();
    const { effectiveTheme } = useTheme();
    const { diagramName } = useChartDB();
    const [logoBase64, setLogoBase64] = useState<string>('');

    useEffect(() => {
        // Convert logo to base64 on component mount
        const img = new Image();
        img.src = effectiveTheme === 'light' ? logoLight : logoDark;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const base64 = canvas.toDataURL('image/png');
                setLogoBase64(base64);
            }
        };
    }, [effectiveTheme]);

    const downloadImage = useCallback(
        (dataUrl: string, type: ImageType) => {
            const a = document.createElement('a');
            a.setAttribute('download', `${diagramName}.${type}`);
            a.setAttribute('href', dataUrl);
            a.click();
        },
        [diagramName]
    );

    const imageCreatorMap: Record<
        ImageType,
        typeof toJpeg | typeof toPng | typeof toSvg
    > = useMemo(
        () => ({
            jpeg: toJpeg,
            png: toPng,
            svg: toSvg,
        }),
        []
    );

    const getBackgroundColor = useCallback(
        (theme: EffectiveTheme, transparent: boolean): string => {
            if (transparent) return 'transparent';
            return theme === 'light' ? '#ffffff' : '#141414';
        },
        []
    );

    /**
     * Calculate the bounding box of all visible nodes using React Flow's built-in method
     */
    const getDiagramBoundingBox = useCallback(() => {
        const nodes = getNodes();
        const visibleNodes = nodes.filter((node) => !node.hidden);

        if (visibleNodes.length === 0) {
            return { x: 0, y: 0, width: 800, height: 600 };
        }

        // Use React Flow's getNodesBounds for accurate bounding box calculation
        // This properly handles node measurements
        const bounds = getNodesBounds(visibleNodes);

        return {
            x: bounds.x - PADDING,
            y: bounds.y - PADDING,
            width: bounds.width + PADDING * 2,
            height: bounds.height + PADDING * 2,
        };
    }, [getNodes]);

    const exportImage: ExportImageContext['exportImage'] = useCallback(
        async (type, { includePatternBG, transparent, scale }) => {
            showLoader({
                animated: false,
            });

            setNodes((nodes) =>
                nodes.map((node) => ({ ...node, selected: false }))
            );

            const imageCreateFn = imageCreatorMap[type];

            // Use requestAnimationFrame followed by setTimeout to ensure DOM is fully updated
            // This is necessary because setNodes triggers a re-render that may not be complete
            requestAnimationFrame(() => {
                setTimeout(async () => {
                    // Calculate the bounding box AFTER DOM has been updated
                    const boundingBox = getDiagramBoundingBox();

                    const viewportElement = window.document.querySelector(
                        '.react-flow__viewport'
                    ) as HTMLElement;

                    const markerDefs = document.querySelector(
                        '.marker-definitions defs'
                    );

                    const tempSvg = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'svg'
                    );
                    tempSvg.style.position = 'absolute';
                    tempSvg.style.top = '0';
                    tempSvg.style.left = '0';
                    tempSvg.style.width = '100%';
                    tempSvg.style.height = '100%';
                    tempSvg.style.overflow = 'visible';
                    tempSvg.style.zIndex = '-50';
                    tempSvg.setAttribute(
                        'viewBox',
                        `0 0 ${boundingBox.width} ${boundingBox.height}`
                    );

                    const defs = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'defs'
                    );

                    // Inline styles for marker elements before copying since skipFonts: true prevents CSS processing
                    const markerCircles = document.querySelectorAll(
                        '.marker-definitions marker circle'
                    ) as NodeListOf<SVGCircleElement>;
                    const markerTexts = document.querySelectorAll(
                        '.marker-definitions marker text'
                    ) as NodeListOf<SVGTextElement>;

                    const originalMarkerStyles: {
                        element: SVGElement;
                        fill: string;
                        stroke: string;
                    }[] = [];

                    markerCircles.forEach((circle) => {
                        const computedStyle = window.getComputedStyle(circle);
                        originalMarkerStyles.push({
                            element: circle,
                            fill: circle.style.fill,
                            stroke: circle.style.stroke,
                        });
                        circle.style.fill = computedStyle.fill;
                        circle.style.stroke = computedStyle.stroke;
                    });

                    markerTexts.forEach((text) => {
                        const computedStyle = window.getComputedStyle(text);
                        originalMarkerStyles.push({
                            element: text,
                            fill: text.style.fill,
                            stroke: text.style.stroke,
                        });
                        text.style.fill = computedStyle.fill;
                    });

                    if (markerDefs) {
                        defs.innerHTML = markerDefs.innerHTML;
                    }

                    // Restore original marker styles
                    originalMarkerStyles.forEach(
                        ({ element, fill, stroke }) => {
                            element.style.fill = fill;
                            element.style.stroke = stroke;
                        }
                    );

                    if (includePatternBG) {
                        const pattern = document.createElementNS(
                            'http://www.w3.org/2000/svg',
                            'pattern'
                        );
                        pattern.setAttribute('id', 'background-pattern');
                        pattern.setAttribute('width', '16');
                        pattern.setAttribute('height', '16');
                        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

                        const dot = document.createElementNS(
                            'http://www.w3.org/2000/svg',
                            'circle'
                        );

                        dot.setAttribute('cx', '8');
                        dot.setAttribute('cy', '8');
                        dot.setAttribute('r', '0.5');
                        const dotColor =
                            effectiveTheme === 'light' ? '#92939C' : '#777777';
                        dot.setAttribute('fill', dotColor);

                        pattern.appendChild(dot);
                        defs.appendChild(pattern);
                    }

                    tempSvg.appendChild(defs);

                    const backgroundRect = document.createElementNS(
                        'http://www.w3.org/2000/svg',
                        'rect'
                    );
                    backgroundRect.setAttribute('x', '0');
                    backgroundRect.setAttribute('y', '0');
                    backgroundRect.setAttribute(
                        'width',
                        String(boundingBox.width)
                    );
                    backgroundRect.setAttribute(
                        'height',
                        String(boundingBox.height)
                    );
                    backgroundRect.setAttribute(
                        'fill',
                        'url(#background-pattern)'
                    );
                    tempSvg.appendChild(backgroundRect);

                    viewportElement.insertBefore(
                        tempSvg,
                        viewportElement.firstChild
                    );

                    // Inline stroke styles for edge paths since skipFonts: true prevents CSS processing
                    const edgePaths = viewportElement.querySelectorAll(
                        '.react-flow__edge-path'
                    ) as NodeListOf<SVGPathElement>;
                    const originalStyles: {
                        element: SVGPathElement;
                        stroke: string;
                        strokeWidth: string;
                    }[] = [];

                    edgePaths.forEach((path) => {
                        const computedStyle = window.getComputedStyle(path);
                        originalStyles.push({
                            element: path,
                            stroke: path.style.stroke,
                            strokeWidth: path.style.strokeWidth,
                        });
                        path.style.stroke = computedStyle.stroke;
                        path.style.strokeWidth = computedStyle.strokeWidth;
                    });

                    try {
                        // Handle SVG export differently
                        if (type === 'svg') {
                            const dataUrl = await imageCreateFn(
                                viewportElement,
                                {
                                    width: boundingBox.width,
                                    height: boundingBox.height,
                                    style: {
                                        width: `${boundingBox.width}px`,
                                        height: `${boundingBox.height}px`,
                                        // Render at 100% zoom (scale=1), positioned to show the full diagram
                                        transform: `translate(${-boundingBox.x}px, ${-boundingBox.y}px) scale(1)`,
                                    },
                                    quality: 1,
                                    pixelRatio: scale,
                                    skipFonts: true,
                                }
                            );
                            downloadImage(dataUrl, type);
                            return;
                        }

                        // For PNG and JPEG, continue with the watermark process
                        const initialDataUrl = await imageCreateFn(
                            viewportElement,
                            {
                                backgroundColor: getBackgroundColor(
                                    effectiveTheme,
                                    transparent
                                ),
                                width: boundingBox.width,
                                height: boundingBox.height,
                                style: {
                                    width: `${boundingBox.width}px`,
                                    height: `${boundingBox.height}px`,
                                    // Render at 100% zoom (scale=1), positioned to show the full diagram
                                    transform: `translate(${-boundingBox.x}px, ${-boundingBox.y}px) scale(1)`,
                                },
                                quality: 1,
                                pixelRatio: scale,
                                skipFonts: true,
                            }
                        );

                        // Create a canvas to combine the diagram and watermark
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        if (!ctx) {
                            downloadImage(initialDataUrl, type);
                            return;
                        }

                        // Set canvas size to match the export size
                        canvas.width = boundingBox.width * scale;
                        canvas.height = boundingBox.height * scale;

                        // Load the exported diagram
                        const diagramImage = new Image();
                        diagramImage.src = initialDataUrl;

                        await new Promise((resolve) => {
                            diagramImage.onload = async () => {
                                // Draw the diagram
                                ctx.drawImage(diagramImage, 0, 0);

                                // Calculate logo size
                                const logoHeight = Math.max(
                                    24,
                                    Math.floor(canvas.width * 0.024)
                                );
                                const padding = Math.max(
                                    12,
                                    Math.floor(logoHeight * 0.5)
                                );

                                // Load and draw the logo
                                const logoImage = new Image();
                                logoImage.src = logoBase64;

                                await new Promise((resolve) => {
                                    logoImage.onload = () => {
                                        // Calculate logo width while maintaining aspect ratio
                                        const logoWidth =
                                            (logoImage.width /
                                                logoImage.height) *
                                            logoHeight;

                                        // Draw logo in bottom-left corner
                                        ctx.globalAlpha = 0.9;
                                        ctx.drawImage(
                                            logoImage,
                                            padding,
                                            canvas.height -
                                                logoHeight -
                                                padding,
                                            logoWidth,
                                            logoHeight
                                        );
                                        ctx.globalAlpha = 1;
                                        resolve(null);
                                    };
                                });

                                // TODO: Add image compression option for PNG and JPEG exports
                                // - Add a compression quality parameter (0-1) to the export options
                                // - For JPEG: use canvas.toDataURL('image/jpeg', quality)
                                // - For PNG: consider using a library like browser-image-compression or pngquant
                                // - Add UI option in export-image-dialog to let user choose compression level
                                // - Display estimated file size before download

                                // Convert canvas to data URL
                                const finalDataUrl = canvas.toDataURL(
                                    type === 'png' ? 'image/png' : 'image/jpeg'
                                );
                                downloadImage(finalDataUrl, type);
                                resolve(null);
                            };
                        });
                    } finally {
                        // Restore original styles
                        originalStyles.forEach(
                            ({ element, stroke, strokeWidth }) => {
                                element.style.stroke = stroke;
                                element.style.strokeWidth = strokeWidth;
                            }
                        );
                        viewportElement.removeChild(tempSvg);
                        hideLoader();
                    }
                }, 50); // Small delay to ensure DOM updates are complete
            });
        },
        [
            getBackgroundColor,
            downloadImage,
            getDiagramBoundingBox,
            hideLoader,
            imageCreatorMap,
            setNodes,
            showLoader,
            effectiveTheme,
            logoBase64,
        ]
    );

    return (
        <exportImageContext.Provider value={{ exportImage }}>
            {children}
        </exportImageContext.Provider>
    );
};
