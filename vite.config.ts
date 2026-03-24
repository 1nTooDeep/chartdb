import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';
import UnpluginInjectPreload from 'unplugin-inject-preload/vite';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        visualizer({
            filename: './stats/stats.html',
            open: false,
        }),
        UnpluginInjectPreload({
            files: [
                {
                    entryMatch: /logo-light.png$/,
                    outputMatch: /logo-light-.*.png$/,
                },
                {
                    entryMatch: /logo-dark.png$/,
                    outputMatch: /logo-dark-.*.png$/,
                },
            ],
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            external: (id) => /__test__/.test(id),
            output: {
                assetFileNames: (assetInfo) => {
                    if (
                        assetInfo.names &&
                        assetInfo.originalFileNames.some((name) =>
                            name.startsWith('src/assets/templates/')
                        )
                    ) {
                        return 'assets/[name][extname]';
                    }
                    return 'assets/[name]-[hash][extname]';
                },
                manualChunks: (id) => {
                    // Split monaco-editor into its own chunk (very large ~15MB)
                    if (
                        id.includes('monaco-editor') ||
                        id.includes('monaco-editor-core')
                    ) {
                        return 'monaco-editor';
                    }
                    // Split @xyflow/react into its own chunk
                    if (
                        id.includes('@xyflow/react') ||
                        id.includes('@xyflow/system')
                    ) {
                        return 'xyflow';
                    }
                    // Split React ecosystem
                    if (id.includes('react-dom') || id.includes('scheduler')) {
                        return 'react-vendor';
                    }
                    // Split other React libraries
                    if (id.includes('react/') && !id.includes('react-dom')) {
                        return 'react-vendor';
                    }
                    // Split UI libraries
                    if (id.includes('lucide-react')) {
                        return 'ui-icons';
                    }
                    // Split editor-related libraries
                    if (
                        id.includes('@codemirror') ||
                        id.includes('@lezer') ||
                        id.includes('@replit/codemirror')
                    ) {
                        return 'codemirror';
                    }
                    // Split DBML-related code
                    if (id.includes('dbml') && !id.includes('node_modules')) {
                        return 'dbml';
                    }
                    // Split canvas components
                    if (
                        id.includes('src/pages/editor-page/canvas/') &&
                        !id.includes('canvas.tsx')
                    ) {
                        return 'canvas-components';
                    }
                    // Split templates data
                    if (id.includes('templates-data')) {
                        return 'templates';
                    }
                },
            },
        },
    },
});
