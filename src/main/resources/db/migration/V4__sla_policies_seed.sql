INSERT INTO sla_policies (priority, target_minutes) VALUES
    ('LOW', 1440),
    ('MEDIUM', 480),
    ('HIGH', 240)
ON CONFLICT (priority) DO NOTHING;
