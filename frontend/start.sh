#!/bin/bash

if [ -f .frontend.pid ]; then
  if ps -p $(cat .frontend.pid) > /dev/null; then
    echo "Frontend đang chạy với PID $(cat .frontend.pid)."
    exit 1
  else
    rm .frontend.pid
  fi
fi

echo "Đang khởi động Mekong Frontend trên 0.0.0.0:3004..."
# Listen trên tất cả interfaces để truy cập qua IP public
setsid nohup npm run dev -- -H 0.0.0.0 -p 3004 > app.log 2>&1 &
PID=$!
echo $PID > .frontend.pid
echo "Frontend đang chạy. PID: $PID"
echo "Truy cập tại: http://113.170.158.188:3004"
echo "Xem log: tail -f app.log"
