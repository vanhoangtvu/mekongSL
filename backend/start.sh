#!/bin/bash

# Compile backend
echo "Compiling backend..."
cd /home/hv/DuAn/Mekong/backend
./mvnw clean compile

# Start backend
echo "Starting backend on 0.0.0.0:8084..."
nohup ./mvnw spring-boot:run > backend.log 2>&1 &
echo $! > .backend.pid

echo "Backend started with PID: $(cat .backend.pid)"
echo "Access at: http://113.170.158.188:8084"
echo "Logs: tail -f backend.log"
