#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"
SERVICE_NAME="openipam"

echo "============================================"
echo "  OpenIPAM Setup Script"
echo "============================================"
echo ""

# --- Detect Linux distribution ---
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        echo "$ID"
    elif [ -f /etc/redhat-release ]; then
        echo "rhel"
    else
        echo "unknown"
    fi
}

DISTRO=$(detect_distro)
echo "[*] Detected distribution: $DISTRO"

# --- Install Python 3 + pip + venv if not present ---
install_python() {
    if command -v python3 &>/dev/null && python3 -c "import venv" &>/dev/null; then
        echo "[+] Python 3 with venv already installed"
        return
    fi

    echo "[*] Installing Python 3 and dependencies..."
    case "$DISTRO" in
        ubuntu|debian|pop|linuxmint)
            sudo apt-get update -qq
            sudo apt-get install -y -qq python3 python3-pip python3-venv
            ;;
        centos|rhel|rocky|alma)
            sudo yum install -y python3 python3-pip python3-virtualenv
            ;;
        fedora)
            sudo dnf install -y python3 python3-pip python3-virtualenv
            ;;
        arch|manjaro)
            sudo pacman -Sy --noconfirm python python-pip python-virtualenv
            ;;
        *)
            echo "[!] Unsupported distribution: $DISTRO"
            echo "    Please install Python 3, pip, and venv manually."
            exit 1
            ;;
    esac
    echo "[+] Python 3 installed"
}

install_python

# --- Create virtualenv ---
if [ ! -d "$VENV_DIR" ]; then
    echo "[*] Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "[+] Virtual environment created at $VENV_DIR"
else
    echo "[+] Virtual environment already exists"
fi

# --- Install dependencies ---
echo "[*] Installing Flask dependencies..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
echo "[+] Dependencies installed"

# --- Initialize database ---
echo "[*] Initializing SQLite database..."
cd "$BACKEND_DIR"
"$VENV_DIR/bin/python" -c "from database import init_db; init_db()"
echo "[+] Database initialized at $BACKEND_DIR/openipam.db"

# --- Optionally create systemd service ---
echo ""
read -p "[?] Create a systemd service for OpenIPAM? (y/N): " CREATE_SERVICE
if [[ "${CREATE_SERVICE,,}" == "y" ]]; then
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

    read -p "[?] Port to run on (default 5000): " PORT
    PORT=${PORT:-5000}

    sudo tee "$SERVICE_FILE" > /dev/null << SERVICEEOF
[Unit]
Description=OpenIPAM - IP Address Management & CMDB
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$BACKEND_DIR
Environment=PATH=$VENV_DIR/bin:/usr/bin
Environment=PORT=$PORT
ExecStart=$VENV_DIR/bin/python app.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    echo "[+] Systemd service created and enabled"
    echo "    Start with: sudo systemctl start $SERVICE_NAME"
    echo "    Status:     sudo systemctl status $SERVICE_NAME"
    echo "    Logs:       journalctl -u $SERVICE_NAME -f"
fi

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  To start OpenIPAM manually:"
echo "    cd $BACKEND_DIR"
echo "    $VENV_DIR/bin/python app.py"
echo ""
echo "  Then open: http://localhost:${PORT:-5000}"
echo ""
echo "  Browser-only mode (no backend):"
echo "    Open index.html directly or serve with:"
echo "    python3 -m http.server 8080"
echo ""
