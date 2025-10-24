# MySQL 8.0 with pre-initialized workflow schema
# Based on official MySQL image with automatic schema initialization
FROM mysql:8.0

# Copy schema initialization script
# MySQL automatically runs .sql files in /docker-entrypoint-initdb.d/ on first startup
COPY 01-schema.sql /docker-entrypoint-initdb.d/

# Configure MySQL defaults
ENV MYSQL_DATABASE=workflow
ENV MYSQL_USER=workflow

# Expose MySQL port
EXPOSE 3306

# Use official MySQL entrypoint
# Schema will be created automatically when container starts for the first time
