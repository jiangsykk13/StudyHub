SELECT 'CREATE DATABASE studyhub_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'studyhub_test')\gexec
