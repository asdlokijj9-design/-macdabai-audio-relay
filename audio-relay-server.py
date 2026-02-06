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

导入 os
导入 json
导入 base64
导入 threading
从 flask 导入 Flask、render_template、request、jsonify
从 flask_socketio import SocketIO, emit

# ============ 配置 ============
端口 =int(os.environ.get(('PORT'), 5000))
DEBUG = os.environ.get('DEBUG','False')lower=='true'

应用 =Flask(__name__, template_folder="templates", static_folder="static")
应用.config['SECRET_KEY'] = '手机麦克风中转'
套接字IO =SocketIO(app, cors_allowed_origigns="*", async_mode='threading')

# ============ 状态管理 ============
已连接设备 ={
    'mobile': False,
    'pc': False
}

音频缓冲区 =[]
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
    返回 渲染模板

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
    打印(' 手机已连接')
    emit('status_update', {
        'mobile_connected': True,
        'pc_connected': connected_devices['pc']
    }, broadcast=True)

@socketio.on('register_pc')
定义 注册_pc():
已连接设备['电脑'] = True
    打印('️ 电脑已连接')
    emit('status_update', {
        'mobile_connected': connected_devices['mobile'],
        'pc_connected': True
    }, broadcast=True)

@socketio.on('audio_chunk')
def handle_audio_chunk(data):
    """接收手机发送的音频块，转发给电脑"""
    # 广播给所有连接的客户端（包括电脑）
    emit('audio_to_pc', {
        'audio': 数据['audio'],
        '时间戳': 数据.获取('时间戳', 0)
    }, broadcast=True)
    
    # 存入缓冲区
    带缓冲区锁：
音频缓冲区.追加({
            'audio': 数据['audio'],
            '时间戳': 数据.获取('时间戳', 0)
        })
        如果音频缓冲区长度大于缓冲区最大大小：
音频缓冲区.弹出(0)

@socketio.on('get_buffer')
def get_buffer():
    """电脑端请求获取缓冲区内容"""
    带缓冲区锁：
        return {'buffer': audio_buffer}
    返回 

@socketio.on('clear_buffer')
def clear_buffer():
    """清空缓冲区"""
    带缓冲区锁：
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
