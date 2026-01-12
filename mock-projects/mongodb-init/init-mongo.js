db = db.getSiblingDB('testdb');

db.createCollection('users');

db.users.insertMany([
  {
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    created: new Date()
  },
  {
    name: 'Bob Williams',
    email: 'bob@example.com',
    age: 35,
    created: new Date()
  },
  {
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 42,
    created: new Date()
  }
]);

print('[MongoDB] Database initialized with sample users');
