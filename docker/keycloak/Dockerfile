FROM quay.io/keycloak/keycloak:26.1
COPY realm-import.json /opt/keycloak/data/import/realm-import.json
ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start-dev", "--import-realm"]
