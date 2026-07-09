#!/bin/bash
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BE_PID_FILE="$BACKEND_DIR/.backend.pid"
FE_PID_FILE="$FRONTEND_DIR/.frontend.pid"
BE_LOG="$BACKEND_DIR/backend.log"
FE_LOG="$FRONTEND_DIR/app.log"
BE_PORT=8084
FE_PORT=3004
ENV_FILE="$FRONTEND_DIR/.env.local"
FE_MODE_FILE="$FRONTEND_DIR/.frontend.mode"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

get_pid() { [[ -f "$1" ]] && cat "$1" || echo ""; }
is_pid_running() { local p=$1; [[ -n "$p" ]] && kill -0 "$p" 2>/dev/null; }

find_pid_by_port() {
  local port=$1
  ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1
}

find_fe_pid() {
  local pid=$(find_pid_by_port "$FE_PORT")
  if [[ -n "$pid" ]]; then echo "$pid"; return; fi
  # fallback: t? file PID và ki?m tra process tree
  local file_pid=$(get_pid "$FE_PID_FILE")
  if is_pid_running "$file_pid"; then
    local child=$(pgrep -P "$file_pid" 2>/dev/null | head -1)
    if is_pid_running "$child"; then echo "$child"; return; fi
    echo "$file_pid"; return
  fi
  echo ""
}

find_be_pid() {
  local pid=$(find_pid_by_port "$BE_PORT")
  if [[ -n "$pid" ]]; then echo "$pid"; return; fi
  local file_pid=$(get_pid "$BE_PID_FILE")
  if is_pid_running "$file_pid"; then echo "$file_pid"; return; fi
  echo ""
}

get_uptime() {
  local pid=$1
  is_pid_running "$pid" || { echo "N/A"; return; }
  local start=$(ps -o lstart= -p "$pid" 2>/dev/null)
  local since=$(date -d "$start" +%s 2>/dev/null)
  local now=$(date +%s)
  local diff=$((now - since))
  local d=$((diff / 86400)) h=$(( (diff % 86400) / 3600 )) m=$(( (diff % 3600) / 60 )) s=$((diff % 60))
  local out=""
  (( d > 0 )) && out+="${d}d "; (( h > 0 )) && out+="${h}h "; (( m > 0 )) && out+="${m}m "
  out+="${s}s"; echo "$out"
}

get_mem() {
  local pid=$1
  is_pid_running "$pid" || { echo "N/A"; return; }
  local mem=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
  [[ -n "$mem" ]] && echo "$(( mem / 1024 )) MB" || echo "N/A"
}

get_frontend_mode() {
  local pid=$1
  if [[ -z "$pid" ]]; then
    [[ -f "$FE_MODE_FILE" ]] && cat "$FE_MODE_FILE" || echo "---"
    return
  fi
  local cmd=$(ps -o args= -p "$pid" 2>/dev/null || true)
  if echo "$cmd" | grep -q "next dev"; then echo "Dev"; return; fi
  if echo "$cmd" | grep -q "next start"; then echo "Prod"; return; fi
  # check parent chain
  local ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  if [[ -n "$ppid" ]] && [[ "$ppid" != "1" ]]; then
    cmd=$(ps -o args= -p "$ppid" 2>/dev/null || true)
    if echo "$cmd" | grep -q "next dev"; then echo "Dev"; return; fi
    if echo "$cmd" | grep -q "next start"; then echo "Prod"; return; fi
  fi
  [[ -f "$FE_MODE_FILE" ]] && cat "$FE_MODE_FILE" || echo "---"
}

get_current_ip() {
  if [[ -f "$ENV_FILE" ]]; then
    sed -n 's/^NEXT_PUBLIC_API_URL=http:\/\/\([^:]*\).*/\1/p' "$ENV_FILE" 2>/dev/null
  fi
}

get_port() {
  local pid=$1 default_port=$2
  is_pid_running "$pid" || { echo "---"; return; }
  local port=$(ss -tlnp 2>/dev/null | grep -F "pid=$pid" | awk '{print $4}' | awk -F: '{print $NF}' | sort -u | paste -sd ',' | sed 's/,/, /g')
  if [[ -z "$port" ]]; then
    local children=$(pgrep -P "$pid" 2>/dev/null || true)
    for child in $children; do
      port=$(ss -tlnp 2>/dev/null | grep -F "pid=$child" | awk '{print $4}' | awk -F: '{print $NF}' | sort -u | paste -sd ',' | sed 's/,/, /g')
      [[ -n "$port" ]] && break
    done
  fi
  echo "${port:-$default_port}"
}

sync_pid_file() {
  local pid_file=$1 port=$2
  local actual=$(find_pid_by_port "$port")
  if [[ -n "$actual" ]]; then
    echo "$actual" > "$pid_file"
  fi
}

stop_pid_graceful() {
  local pid=$1 name=$2
  is_pid_running "$pid" || { echo -e "  ${YELLOW}$name không chạy${NC}"; return 0; }
  echo -e "  ${YELLOW}→ Đang dừng $name (PID: $pid)...${NC}"
  kill "$pid" 2>/dev/null || true
  for _ in {1..15}; do
    is_pid_running "$pid" || { echo -e "  ${GREEN}✓ $name đã dừng${NC}"; return 0; }
    sleep 1
  done
  kill -9 "$pid" 2>/dev/null || true
  echo -e "  ${GREEN}✓ $name đã dừng (SIGKILL)${NC}"
}

cleanup() {
  echo ""
  echo -e "  ${GREEN}Tạm biệt!${NC}"
  exit 0
}

BOX_TOP="┌──────────────────────────────────────────────────────────────────────────────┐"
BOX_MID="├──────────────────────────────────────────────────────────────────────────────┤"
BOX_BOT="└──────────────────────────────────────────────────────────────────────────────┘"

get_visual_length() {
  local clean=$(echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g')
  echo "${#clean}"
}

pad_visual() {
  local str="$1"
  local width=$2
  local len=$(get_visual_length "$str")
  local fill=$((width - len))
  if (( fill > 0 )); then
    local padding=$(printf "%${fill}s")
    echo -n "$str$padding"
  else
    echo -n "${str:0:width}"
  fi
}

print_line_left() {
  local content="$1"
  local pad_char="${2:- }"
  local len=$(get_visual_length "$content")
  local fill=$((78 - len))
  if (( fill < 0 )); then
    echo -e "${CYAN}│${NC}${content:0:78}${CYAN}│${NC}"
  else
    local padding=""
    if (( fill > 0 )); then
      printf -v padding "%${fill}s"
      padding=${padding// /$pad_char}
    fi
    echo -e "${CYAN}│${NC}$content$padding${CYAN}│${NC}"
  fi
}

print_line_center() {
  local content="$1"
  local len=$(get_visual_length "$content")
  local total_pad=$((78 - len))
  if (( total_pad <= 0 )); then
    echo -e "${CYAN}│${NC}${content:0:78}${CYAN}│${NC}"
  else
    local pad_left=$((total_pad / 2))
    local pad_right=$((total_pad - pad_left))
    local space_left=$(printf "%${pad_left}s")
    local space_right=$(printf "%${pad_right}s")
    echo -e "${CYAN}│${NC}$space_left$content$space_right${CYAN}│${NC}"
  fi
}

print_menu_row() {
  local num1=$1 text1=$2 num2=$3 text2=$4
  local col1_txt=$(pad_visual "$text1" 28)
  local col2_txt=$(pad_visual "$text2" 28)
  local item1="  [${CYAN}$num1${NC}] $col1_txt"
  local item2="  [${CYAN}$num2${NC}] $col2_txt"
  print_line_left "$item1$item2"
}

print_dashboard() {
  clear
  echo -e "${CYAN}$BOX_TOP${NC}"
  print_line_center "${CYAN}${BOLD}MEKONG WebGIS - QUẢN LÝ HỆ THỐNG${NC}"
  echo -e "${CYAN}$BOX_MID${NC}"
  print_status
  echo -e "${CYAN}$BOX_MID${NC}"
  print_menu
  echo -e "${CYAN}$BOX_BOT${NC}"
  echo ""
}

display_line() {
  local name=$1 pid=$2 port=$3 up=$4 mem=$5
  local icon=$GREEN; [[ -z "$pid" ]] && icon=$RED
  
  local col1_bullet="${icon}${BOLD}●${NC} "
  local col1_name=$(pad_visual "$name" 12)
  
  local col2_pid=$(pad_visual "${pid:----}" 8)
  local col3_port=$(pad_visual "${port:-0}" 8)
  local col4_mode=$(pad_visual "$6" 6)
  local col5_up=$(pad_visual "${up:-N/A}" 14)
  local col6_mem=$(pad_visual "${mem:-N/A}" 10)
  
  print_line_left "  $col1_bullet${BOLD}$col1_name${NC} │ $col2_pid │ $col3_port │ $col4_mode │ $col5_up │ $col6_mem"
}

print_status() {
  sync_pid_file "$BE_PID_FILE" "$BE_PORT"
  sync_pid_file "$FE_PID_FILE" "$FE_PORT"
  local be_pid=$(get_pid "$BE_PID_FILE") fe_pid=$(get_pid "$FE_PID_FILE")

  local be_real=$(find_be_pid) fe_real=$(find_fe_pid)
  [[ -n "$be_real" ]] && be_pid="$be_real"
  [[ -n "$fe_real" ]] && fe_pid="$fe_real"

  local be_port=$(get_port "$be_pid" "$BE_PORT") fe_port=$(get_port "$fe_pid" "$FE_PORT")
  local be_up=$(get_uptime "$be_pid") fe_up=$(get_uptime "$fe_pid")
  local be_mem=$(get_mem "$be_pid") fe_mem=$(get_mem "$fe_pid")
  local fe_mode=$(get_frontend_mode "$fe_pid")

  print_line_left "  ${BOLD}TRẠNG THÁI HỆ THỐNG${NC}"
  print_line_left "" "─"
  
  local header_col1="    $(pad_visual "Dịch vụ" 12)"
  local header_col2=$(pad_visual "PID" 8)
  local header_col3=$(pad_visual "Cổng" 8)
  local header_col4=$(pad_visual "Mode" 6)
  local header_col5=$(pad_visual "Uptime" 14)
  local header_col6=$(pad_visual "RAM" 10)
  print_line_left "${BOLD}$header_col1 │ $header_col2 │ $header_col3 │ $header_col4 │ $header_col5 │ $header_col6${NC}"
  print_line_left "" "─"

  display_line "Backend"  "$be_pid" "$be_port" "$be_up" "$be_mem" "---"
  display_line "Frontend" "$fe_pid" "$fe_port" "$fe_up" "$fe_mem" "$fe_mode"
  print_line_left "" "─"
  
  if [[ -n "$current_ip" ]]; then
    print_line_left "  ${BOLD}IP hiện tại:${NC} ${CYAN}$current_ip${NC}"
  else
    print_line_left "  ${BOLD}IP hiện tại:${NC} ${YELLOW}Chưa cấu hình${NC}"
  fi
  if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
    print_line_left "  ${RED}⚠ Thiếu file .env (S3, API keys)${NC}"
  fi
}

print_menu() {
  print_line_left "  ${BOLD}MENU CHỨC NĂNG${NC}"
  print_line_left "" "─"
  print_menu_row "1" "Khởi động backend"       "6" "Build & Restart backend"
  print_menu_row "2" "FE Dev mode"             "7" "Xem log backend"
  print_menu_row "3" "FE Production mode"      "8" "Xem log frontend"
  print_menu_row "4" "Dừng backend"           "9" "Đổi IP"
  print_menu_row "5" "Dừng frontend"         "0" "Thoát"
  print_menu_row "0" "Thoát"               "A" "Restart tất cả"
}

pause() {
  echo ""
  read -p "  Nhấn Enter để tiếp tục..." || true
}

start_backend() {
  sync_pid_file "$BE_PID_FILE" "$BE_PORT"
  if is_pid_running "$(get_pid "$BE_PID_FILE")"; then
    echo -e "  ${YELLOW}Backend đang chạy (PID: $(get_pid "$BE_PID_FILE"))${NC}"; return 0
  fi
  echo -e "  ${YELLOW}→ Khởi động backend...${NC}"
  if [[ -f "$SCRIPT_DIR/.env" ]]; then
    set -a; source "$SCRIPT_DIR/.env"; set +a
  fi
  cd "$BACKEND_DIR"
  local jar=$(ls target/*.jar 2>/dev/null | head -1)
  if [[ -z "$jar" ]]; then
    echo -e "  ${YELLOW}Không tìm thấy JAR, đang build...${NC}"
    ./mvnw -q package -DskipTests -Djansi.tmpdir="$BACKEND_DIR/target/tmp" || {
      echo -e "  ${RED}✗ Build thất bại${NC}"
      cd "$SCRIPT_DIR"
      return 1
    }
    jar=$(ls target/*.jar 2>/dev/null | head -1)
  fi
  local cors_origins="http://localhost:3004,http://localhost:3000"
  local ip=$(get_current_ip)
  [[ -n "$ip" ]] && cors_origins="http://$ip:3004,http://$ip:3000,http://localhost:3004,http://localhost:3000"
  CORS_ALLOWED_ORIGINS="$cors_origins" nohup java -jar "$jar" > "$BE_LOG" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "$pid" > "$BE_PID_FILE"
  cd "$SCRIPT_DIR"
  for _ in {1..10}; do
    sleep 1
    grep -q "Started" "$BE_LOG" 2>/dev/null && break
  done
  sync_pid_file "$BE_PID_FILE" "$BE_PORT"
  echo -e "  ${GREEN}✓ Backend khởi động (PID: $(get_pid "$BE_PID_FILE"))${NC}"
}

start_frontend() {
  sync_pid_file "$FE_PID_FILE" "$FE_PORT"
  if is_pid_running "$(get_pid "$FE_PID_FILE")"; then
    echo -e "  ${YELLOW}Frontend đang chạy (PID: $(get_pid "$FE_PID_FILE"))${NC}"; return 0
  fi
  echo -e "  ${YELLOW}→ Khởi động frontend...${NC}"
  cd "$FRONTEND_DIR"
  > "$FE_LOG"
  nohup npm run dev > "$FE_LOG" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "$pid" > "$FE_PID_FILE"
  cd "$SCRIPT_DIR"
  for _ in {1..15}; do
    sleep 1
    grep -q "Ready" "$FE_LOG" 2>/dev/null && break
  done
  echo "dev" > "$FE_MODE_FILE"
  sync_pid_file "$FE_PID_FILE" "$FE_PORT"
  echo -e "  ${GREEN}✓ Frontend dev khởi động (PID: $(get_pid "$FE_PID_FILE"), port $FE_PORT)${NC}"
}

start_frontend_prod() {
  sync_pid_file "$FE_PID_FILE" "$FE_PORT"
  if is_pid_running "$(get_pid "$FE_PID_FILE")"; then
    echo -e "  ${YELLOW}Frontend đang chạy (PID: $(get_pid "$FE_PID_FILE"))${NC}"; return 0
  fi
  echo -e "  ${YELLOW}→ Build frontend...${NC}"
  cd "$FRONTEND_DIR"
  npm run build 2>&1 | tail -5 || {
    echo -e "  ${RED}✗ Build thất bại${NC}"
    cd "$SCRIPT_DIR"
    return 1
  }
  echo -e "  ${YELLOW}→ Khởi động frontend production...${NC}"
  > "$FE_LOG"
  nohup npm run start > "$FE_LOG" 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null || true
  echo "$pid" > "$FE_PID_FILE"
  cd "$SCRIPT_DIR"
  for _ in {1..10}; do
    sleep 1
    grep -q "Ready\|Listening" "$FE_LOG" 2>/dev/null && break
  done
  echo "prod" > "$FE_MODE_FILE"
  sync_pid_file "$FE_PID_FILE" "$FE_PORT"
  echo -e "  ${GREEN}✓ Frontend production khởi động (PID: $(get_pid "$FE_PID_FILE"), port $FE_PORT)${NC}"
}

stop_backend() {
  local pid=$(get_pid "$BE_PID_FILE")
  stop_pid_graceful "$pid" "Backend"
  rm -f "$BE_PID_FILE"
}

stop_frontend() {
  local pid=$(get_pid "$FE_PID_FILE")
  stop_pid_graceful "$pid" "Frontend"
  rm -f "$FE_PID_FILE" "$FE_MODE_FILE"
}

rebuild_backend() {
  echo ""
  stop_backend
  sleep 1
  echo -e "  ${YELLOW}→ Build backend...${NC}"
  cd "$BACKEND_DIR"
  ./mvnw clean compile -DskipTests -q -Djansi.tmpdir="$BACKEND_DIR/target/tmp" && \
    echo -e "  ${GREEN}✓ Build OK${NC}" || {
      echo -e "  ${RED}✗ Build thất bại${NC}"
      cd "$SCRIPT_DIR"
      return 1
    }
  cd "$SCRIPT_DIR"
  start_backend
  echo -e "  ${GREEN}✓ Hoàn tất${NC}"
}

change_ip() {
  local current=$(get_current_ip)
  echo ""
  echo -e "  ${BOLD}ĐỔI IP${NC}"
  echo "  ─────────────────────────────────"
  [[ -n "$current" ]] && echo -e "  IP hiện tại: ${CYAN}$current${NC}" || echo -e "  IP hiện tại: ${YELLOW}Chưa cấu hình${NC}"
  echo ""
  read -p "  Nhập IP mới (ví dụ: 123.22.61.134): " new_ip || true
  if [[ -z "$new_ip" ]]; then
    echo -e "  ${RED}IP không được để trống${NC}"
    return
  fi
  if [[ ! "$new_ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "  ${RED}IP không hợp lệ. Định dạng: xxx.xxx.xxx.xxx${NC}"
    return
  fi
  echo ""
  echo -e "  ${YELLOW}→ Cập nhật frontend/.env.local...${NC}"
  echo "NEXT_PUBLIC_API_URL=http://$new_ip:8084/api" > "$ENV_FILE"
  echo -e "  ${GREEN}✓ Đã cập nhật .env.local${NC}"
  echo ""
  echo -e "  ${YELLOW}→ Khởi động lại dịch vụ để áp dụng IP mới...${NC}"
  stop_backend || true
  stop_frontend || true
  sleep 1
  start_backend || true
  start_frontend || true
  echo ""
  echo -e "  ${GREEN}✓ Đã chuyển sang IP: $new_ip${NC}"
  echo -e "  ${GREEN}  Frontend: http://$new_ip:$FE_PORT${NC}"
  echo -e "  ${GREEN}  Backend:  http://$new_ip:$BE_PORT/api${NC}"
}

view_log() {
  local log_file=$1 label=$2
  if [[ ! -f "$log_file" ]]; then
    echo -e "  ${RED}Chưa có log file: $log_file${NC}"
    pause
    return
  fi
  clear
  echo -e "  ${BOLD}Log $label${NC} (Ctrl+C để thoát)"
  echo "  ─────────────────────────────────"
  tail -f -n 50 "$log_file" 2>/dev/null || true
}

trap cleanup INT TERM

while true; do
  print_dashboard

  echo -ne "  ${BOLD}Chọn chức năng [0-9/A]:${NC} "
  read choice || true
  case "$choice" in
    1) start_backend; pause ;;
    2) start_frontend; pause ;;
    3) start_frontend_prod; pause ;;
    4) stop_backend; pause ;;
    5) stop_frontend; pause ;;
    6) rebuild_backend; pause ;;
    7) view_log "$BE_LOG" "backend" ;;
    8) view_log "$FE_LOG" "frontend" ;;
    9) change_ip; pause ;;
    A|a) stop_backend || true; stop_frontend || true; sleep 1; start_backend || true; start_frontend || true; pause ;;
    0) cleanup ;;
    *) echo -e "  ${RED}Lựa chọn không hợp lệ${NC}"; sleep 1 ;;
  esac
done
