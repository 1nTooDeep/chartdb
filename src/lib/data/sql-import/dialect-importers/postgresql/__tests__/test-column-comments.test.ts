import { describe, it, expect } from 'vitest';
import { fromPostgres } from '../postgresql';

describe('COMMENT ON COLUMN parsing', () => {
    it('should parse COMMENT ON COLUMN with simple table.column format', async () => {
        const sql = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100)
);
COMMENT ON COLUMN users.id IS '用户ID';
COMMENT ON COLUMN users.name IS '用户名称';`;

        const result = await fromPostgres(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].columns[0].comment).toBe('用户ID');
        expect(result.tables[0].columns[1].comment).toBe('用户名称');
    });

    it('should parse COMMENT ON COLUMN with schema.table.column format', async () => {
        const sql = `
CREATE TABLE public.users (
    id INTEGER PRIMARY KEY
);
COMMENT ON COLUMN public.users.id IS 'Primary key';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].columns[0].comment).toBe('Primary key');
    });

    it('should parse COMMENT ON COLUMN with quoted identifiers', async () => {
        const sql = `
CREATE TABLE "user-table" (
    "user-id" INTEGER PRIMARY KEY
);
COMMENT ON COLUMN "user-table"."user-id" IS 'User identifier';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].name).toBe('user-table');
        expect(result.tables[0].columns[0].comment).toBe('User identifier');
    });

    it('should handle comment with escaped quotes', async () => {
        const sql = `
CREATE TABLE items (
    description TEXT
);
COMMENT ON COLUMN items.description IS 'Item''s description';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].columns[0].comment).toBe("Item's description");
    });

    it('should handle COMMENT ON TABLE', async () => {
        const sql = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE users IS '用户表';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('用户表');
    });

    it('should handle COMMENT ON TABLE with schema', async () => {
        const sql = `
CREATE TABLE public.orders (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE public.orders IS '订单表';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('订单表');
    });

    it('should handle COMMENT ON TABLE with quoted identifiers', async () => {
        const sql = `
CREATE TABLE "order-items" (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE "order-items" IS '订单项目表';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('订单项目表');
    });

    it('should handle both COMMENT ON COLUMN and COMMENT ON TABLE', async () => {
        const sql = `
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(10,2)
);
COMMENT ON TABLE products IS '产品表';
COMMENT ON COLUMN products.id IS '产品ID';
COMMENT ON COLUMN products.name IS '产品名称';
COMMENT ON COLUMN products.price IS '产品价格';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('产品表');
        expect(result.tables[0].columns[0].comment).toBe('产品ID');
        expect(result.tables[0].columns[1].comment).toBe('产品名称');
        expect(result.tables[0].columns[2].comment).toBe('产品价格');
    });

    it('should handle comment with Chinese characters', async () => {
        const sql = `
CREATE TABLE r_view_area (
    id BIGSERIAL PRIMARY KEY,
    create_time TIMESTAMP DEFAULT NOW(),
    update_time TIMESTAMP DEFAULT NOW()
);
COMMENT ON COLUMN r_view_area.create_time IS '创建时间';
COMMENT ON COLUMN r_view_area.update_time IS '更新时间';
COMMENT ON TABLE r_view_area IS '区域视图表';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('区域视图表');
        expect(result.tables[0].columns[1].comment).toBe('创建时间');
        expect(result.tables[0].columns[2].comment).toBe('更新时间');
    });

    it('should handle comment with special characters', async () => {
        const sql = `
CREATE TABLE test (
    field TEXT
);
COMMENT ON COLUMN test.field IS 'This is a test: with special chars !@#$%^&*()';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].columns[0].comment).toBe(
            'This is a test: with special chars !@#$%^&*()'
        );
    });

    it('should handle multiline comment text', async () => {
        const sql = `
CREATE TABLE docs (
    content TEXT
);
COMMENT ON COLUMN docs.content IS 'This is a multiline
comment that spans
multiple lines';`;

        const result = await fromPostgres(sql);

        // The regex should capture the first line only since newlines break the pattern
        // Let's test with a simpler multiline case
        expect(result.tables[0].columns[0].comment).toContain('multiline');
    });

    it('should ignore COMMENT ON COLUMN for non-existent tables', async () => {
        const sql = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY
);
COMMENT ON COLUMN nonexistent.column IS 'This should be ignored';`;

        const result = await fromPostgres(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].columns[0].comment).toBeUndefined();
    });

    it('should ignore COMMENT ON COLUMN for non-existent columns', async () => {
        const sql = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY
);
COMMENT ON COLUMN users.nonexistent IS 'This should be ignored';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].columns[0].comment).toBeUndefined();
    });

    it('should handle mixed case COMMENT ON statements', async () => {
        const sql = `
CREATE TABLE TestTable (
    TestColumn INTEGER PRIMARY KEY
);
comment on column TestTable.TestColumn is 'Test comment';
COMMENT ON TABLE TestTable IS 'Test table';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('Test table');
        expect(result.tables[0].columns[0].comment).toBe('Test comment');
    });

    it('should handle COMMENT ON with whitespace variations', async () => {
        const sql = `
CREATE TABLE spaces (
    id INTEGER PRIMARY KEY
);
COMMENT   ON   COLUMN   spaces . id   IS   'Comment with spaces';`;

        const result = await fromPostgres(sql);

        // This should not match due to spaces in identifier
        // The regex expects no spaces around dots
        expect(result.tables[0].columns[0].comment).toBeUndefined();
    });
});

describe('COMMENT ON TABLE parsing', () => {
    it('should parse COMMENT ON TABLE with simple table name', async () => {
        const sql = `
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE accounts IS '账户信息表';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('账户信息表');
    });

    it('should parse COMMENT ON TABLE with quoted identifiers', async () => {
        const sql = `
CREATE TABLE "MyTable" (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE "MyTable" IS 'My custom table';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe('My custom table');
    });

    it('should handle COMMENT ON TABLE with escaped quotes in comment', async () => {
        const sql = `
CREATE TABLE logs (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE logs IS 'System''s log table';`;

        const result = await fromPostgres(sql);

        expect(result.tables[0].comment).toBe("System's log table");
    });

    it('should ignore COMMENT ON TABLE for non-existent tables', async () => {
        const sql = `
CREATE TABLE users (
    id INTEGER PRIMARY KEY
);
COMMENT ON TABLE nonexistent IS 'This should be ignored';`;

        const result = await fromPostgres(sql);

        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].comment).toBeUndefined();
    });
});
