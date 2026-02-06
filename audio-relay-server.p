#!/usr/bin/env python3
"""
手机麦克风音频流中转服务器
手机录音 → WebSocket发送 → 服务器中转 → 电脑接收

使用方法：
    python audio-relay-server.py

默认端口：5000
访问：
    手机端：http://你的IP:5000/mobile.html
    电脑端：http://你的IP:5000/pc.html
"""

import os
import json
import base64
import threading
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit

# ============ 配置 ============
PORT = int(os.environ.get('PORT', 5000))
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

app = Flask(__name__)
app.config['SECRET_KEY'] = '手机麦克风中转'
socketio = SocketIO(app, cors_allowed_origigns="*", async_mode='threading')

# ============ 状态管理 ============
connected_devices = {
    'mobile': False,
    'pc': False
}

audio_buffer = []
buffer_lock = threading.Lock()
buffer_max_size = 100  # 最多保留100个音频块

# ============ 路由 ============

@app.route('/')
def index():
    return render_template('relay-index.html')

@app.route('/mobile.html')
def mobile_page():
    return render_template('mobile.html')

@app.route('/pc.html')
def pc_page():
    return render_template('pc.html')

@app.route('/status')
def status():
    return jsonify({
        'mobile_connected': connected_devices['mobile'],
        'pc_connected': connected_devices['pc']
    })

# ============ WebSocket 事件 ============

@socketio.on('connect')
def handle_connect():
    print(f'🔌 新设备连接: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'🔌 设备断开: {request.sid}')
    # 通知对方
    emit('device_disconnected', {'role': 'unknown'}, broadcast=True)

@socketio.on('register_mobile')
def register_mobile():
    connected_devices['mobile'] = True
    print('📱 手机已连接')
    emit('status_update', {
        'mobile_connected': True,
        'pc_connected': connected_devices['pc']
    }, broadcast=True)

@socketio.on('register_pc')
def register_pc():
    connected_devices['pc'] = True
    print('🖥️ 电脑已连接')
    emit('status_update', {
        'mobile_connected': connected_devices['mobile'],
        'pc_connected': True
    }, broadcast=True)

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """接收手机发送的音频块，转发给电脑"""
    if connected_devices['pc']:
        # 转发给电脑
        emit('audio_to_pc', {
            'audio': data['audio'],
            'timestamp': data.get('timestamp', 0)
        }, room='pc')
        
        # 存入缓冲区（供重连后使用）
        with buffer_lock:
            audio_buffer.append({
                'audio': data['audio'],
                'timestamp': data.get('timestamp', 0)
            })
            if len(audio_buffer) > buffer_max_size:
                audio_buffer.pop(0)

@socketio.on('get_buffer')
def get_buffer():
    """电脑端请求获取缓冲区内容"""
    with buffer_lock:
        return {'buffer': audio_buffer}
    return {'buffer': []}

@socketio.on('clear_buffer')
def clear_buffer():
    """清空缓冲区"""
    with buffer_lock:
        audio_buffer.clear()
    emit('buffer_cleared')

@socketio.on('ping')
def ping():
    emit('pong')

# ============ 启动 ============

if __name__ == '__main__':
    print("=" * 50)
    print("📱 手机麦克风音频流中转服务器")
    print("=" * 50)
    print()
    print("📍 访问地址：")
    print(f"   手机端：http://localhost:{PORT}/mobile.html")
    print(f"   电脑端：http://localhost:{PORT}/pc.html")
    print()
    print("📡 状态：")
    print(f"   手机连接：{'✓' if connected_devices['mobile'] else '✗'}")
    print(f"   电脑连接：{'✓' if connected_devices['pc'] else '✗'}")
    print()
    print("💡 使用说明：")
    print("   1. 手机打开 /mobile.html，点击开始录音")
    print("   2. 电脑打开 /pc.html，连接后等待音频")
    print("   3. 对着手机说话，音频会实时传到电脑")
    print("=" * 50)
    
    socketio.run(app, host='0.0.0.0', port=PORT, debug=DEBUG, allow_unsafe_werkzeug=True)
