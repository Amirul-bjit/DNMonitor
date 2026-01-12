-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO products (name, description, price, stock) VALUES
    ('Laptop Pro', 'High-performance laptop', 1299.99, 50),
    ('Wireless Mouse', 'Ergonomic wireless mouse', 29.99, 200),
    ('Mechanical Keyboard', 'RGB mechanical keyboard', 89.99, 100),
    ('USB-C Hub', '7-in-1 USB-C hub', 49.99, 150),
    ('Monitor 27"', '4K UHD monitor', 399.99, 75);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample orders
INSERT INTO orders (customer_name, product_id, quantity, total_amount) VALUES
    ('John Doe', 1, 1, 1299.99),
    ('Jane Smith', 2, 2, 59.98),
    ('Mike Johnson', 3, 1, 89.99);

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE '[PostgreSQL] Database initialized with sample data';
    RAISE NOTICE '[PostgreSQL] Created tables: products, orders';
    RAISE NOTICE '[PostgreSQL] Inserted % products', (SELECT COUNT(*) FROM products);
    RAISE NOTICE '[PostgreSQL] Inserted % orders', (SELECT COUNT(*) FROM orders);
END $$;
