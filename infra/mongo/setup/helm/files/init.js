// MongoDB initialization script for TelcoX audit system

db = db.getSiblingDB('telcox_audit');

db.createCollection('audit_events', {
    validator: {
        $jsonSchema: {
            bsonType: 'object',
            required: ['service', 'action', 'resource_type', 'resource_id', 'status', 'timestamp'],
            properties: {
                _id: { bsonType: 'string' },
                service: { bsonType: 'string', description: 'Microservice name' },
                action: {
                    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'PROCESS', 'ACTIVATE', 'VERIFY'],
                    description: 'Action type'
                },
                resource_type: { bsonType: 'string', description: 'Type of resource affected' },
                resource_id: { bsonType: 'string', description: 'ID of affected resource' },
                user_id: { bsonType: 'string', description: 'User who performed action' },
                status: {
                    enum: ['SUCCESS', 'FAILED'],
                    description: 'Operation status'
                },
                payload_in: { bsonType: 'object', description: 'Input data' },
                payload_out: { bsonType: 'object', description: 'Output data' },
                ip_address: { bsonType: 'string', description: 'IP address of requestor' },
                timestamp: { bsonType: 'date', description: 'Event timestamp' },
                duration_ms: { bsonType: 'double', description: 'Operation duration' },
                error_message: { bsonType: 'string', description: 'Error details if failed' },
                metadata: { bsonType: 'object', description: 'Additional non-sensitive audit metadata' },
                created_at: { bsonType: 'date' }
            }
        }
    }
});

db.audit_events.createIndex({ resource_id: 1 });
db.audit_events.createIndex({ service: 1 });
db.audit_events.createIndex({ timestamp: -1 });
db.audit_events.createIndex({ status: 1 });
db.audit_events.createIndex({ resource_type: 1 });
db.audit_events.createIndex({ service: 1, resource_id: 1, timestamp: -1 });
db.audit_events.createIndex({ resource_type: 1, resource_id: 1, timestamp: -1 });
db.audit_events.createIndex({ user_id: 1, timestamp: -1 });
db.audit_events.createIndex({ created_at: 1 }, { expireAfterSeconds: 63072000 });

db.createCollection('customers');
db.createCollection('invoices');
db.createCollection('payments');
db.createCollection('notifications');
db.createCollection('orders');

db.customers.createIndex({ email: 1 }, { unique: true, sparse: true });
db.customers.createIndex({ document_id: 1 }, { unique: true, sparse: true });
db.customers.createIndex({ status: 1 });

db.invoices.createIndex({ customer_id: 1 });
db.invoices.createIndex({ status: 1 });
db.invoices.createIndex({ due_date: 1 });

db.payments.createIndex({ customer_id: 1 });
db.payments.createIndex({ invoice_id: 1 });
db.payments.createIndex({ status: 1 });

db.customers.createIndex({ full_name: 'text', email: 'text' });
db.audit_events.createIndex({ error_message: 'text' });

db.audit_events.insertOne({
    _id: 'sample-audit-001',
    service: 'system-init',
    action: 'CREATE',
    resource_type: 'DATABASE',
    resource_id: 'telcox_audit_mongodb',
    status: 'SUCCESS',
    timestamp: new Date(),
    duration_ms: 25.5,
    created_at: new Date()
});

print('MongoDB initialization completed successfully');
