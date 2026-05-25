#!/bin/bash

if [ -f .frontend.pid ]; then
  PID=$(cat .frontend.pid)
  if ps -p $PID > /dev/null; then
    echo "Đang dừng Mekong Frontend (PID: $PID)..."
    # Dùng SIGTERM để dừng nhẹ nhàng tiến trình cha và tất cả các tiến trình con liên quan (nếu có)
    # Next.js thường tạo ra các tiến trình con nên ta kill cả process group
    kill -- -$PID 2>/dev/null || kill $PID
    rm .frontend.pid
    echo "Đã dừng thành công."
  else
    echo "Tiến trình (PID: $PID) không hoạt động. Dọn dẹp PID file."
    rm .frontend.pid
  fi
else
  echo "Không tìm thấy file .frontend.pid. Đang tìm các tiến trình npm run dev..."
  PIDS=$(pgrep -f "npm run dev")
  if [ -n "$PIDS" ]; then
    echo "Đang dừng các tiến trình: $PIDS"
    kill $PIDS
    echo "Đã dừng thành công."
  else
    echo "Không có tiến trình Mekong Frontend nào đang chạy."
  fi
fi
