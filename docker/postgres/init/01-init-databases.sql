CREATE USER kaizen_user WITH PASSWORD 'kaizen_pass';
CREATE USER keycloak WITH PASSWORD 'keycloak';

CREATE DATABASE kaizendesk OWNER kaizen_user;
CREATE DATABASE keycloak OWNER keycloak;

GRANT ALL PRIVILEGES ON DATABASE kaizendesk TO kaizen_user;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
