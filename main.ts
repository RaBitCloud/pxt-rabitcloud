enum HttpMethods {
    //% block="GET"
    Get,
    //% block="HEAD"
    Head,
    //% block="POST"
    Post,
    //% block="PUT"
    Put,
    //% block="DELETE"
    Delete,
    //% block="OPTIONS"
    Options,
    //% block="TRACE"
    Trace,
    //% block="PATCH"
    Patch,
}

function sterile(input: string): string {
    return input.replace(':', '');
}
function sterileReplace(input: string): string {
    return input.replace(':', '%3A');
}

/**
* Custom blocks
*/
//% weight=100 color="#3854dc"
namespace rabitcloud {

    // 
    // let evt_conn: number = 0;
    // let evt_bgt: number = 0;
    
    let isDebug = false;

    const CR = "\r";
    const NL = "\n";

    const MSG_INIT_T = 'it';
    const MSG_INIT_R = 'ir';
    const MSG_HTTP_T = 'ht';
    const MSG_HTTP_R = 'hr';
    
    const MSG_MQTT_PUB_T = 'mp';
    const MSG_MQTT_SUB_T = 'ms';
    const MSG_MQTT_SUB_R = 'mr';

    const MSG_LAN_PUB_T = 'lp';
    const MSG_LAN_SUB_T = 'ls';
    const MSG_LAN_SUB_R = 'lr';
    
    // const MSG_WHENGATE_T = 'wt';
    // const MSG_WHENGATE_R = 'wr';
    // const MSG_IFTTT_T = 'ft';
    // const MSG_IFTTT_R = 'fr';
    const MSG_COURIER_T = 'ct';
    const MSG_COURIER_R = 'cr';
    const MSG_ADAFRUIT_T = 'at';
    const MSG_ADAFRUIT_R = 'ar';
    
    const UART_DELIMITER = "\n";
    const UART_SEPARATOR = ":";

    interface CallbackMap {
        [key: string]: (status: number, payload: string) => void
    }

    let callbacks: CallbackMap = {};

    let isConnected = false;

    let _initHandler: (success: boolean) => void = null
    
    let subscriptions : string[] = [];

    function processLine(msg: String){
        let parts = msg.split(UART_SEPARATOR);
        if (parts.length > 0) { // 2 parts or move
            if(parts[0] == MSG_INIT_R){
                if (parts[1].length < 1) {
                    isConnected = true;
                    for(let i = 0; i < subscriptions.length; i++){
                        bluetooth.uartWriteLine(subscriptions[i]);// prevent new mobile do not know
                        if(isDebug){
                            serial.writeLine(`re-subs:${subscriptions[i]}`);
                        }
                    }
                    if (_initHandler != null) {
                        _initHandler(true)
                    }
                } else {
                    if (_initHandler != null) {
                        _initHandler(false)
                    }
                }
                return;
            }
            if(parts.length > 1){
                switch (parts[0]) {
                case MSG_HTTP_R:
                // case MSG_IFTTT_R:
                // case MSG_WHENGATE_R:
                case MSG_ADAFRUIT_R:
                    if (typeof callbacks[parts[1]] === 'function' && parts.length > 3) {
                        callbacks[parts[1]](+parts[2], parts[3])
                    }
                    break;
                case MSG_MQTT_SUB_R:
                case MSG_LAN_SUB_R:
                    if (typeof callbacks[parts[1]] === 'function' && parts.length > 2) {
                        callbacks[parts[1]](200, parts[2])
                    }
                    break;
                case MSG_COURIER_R:
                    if (typeof callbacks[parts[1]] === 'function' && parts.length > 2) {
                        callbacks[parts[1]](+200, parts[2])
                    }
                    break;
                }
            }
        }
    }

    let uartIn = '';

    function onDataReceive(){
        let tmp = bluetooth.uartReadUntil(UART_DELIMITER);
        if(isDebug){
            serial.writeLine(`receive: ${tmp}`);
        }
        switch(tmp.charAt(tmp.length-1)){
            case CR:
            case NL:
                uartIn += tmp.trim();
                processLine(uartIn);
                uartIn = '';
                break;
            default:
                uartIn += tmp;
                break;
        }
    }
    
    /**
     * set init handler
     * @param initHandler 
     */
    //% topblock=true
    //% block="set optional init handler"
    export function setRabitInitHandler(initHandler: (success: boolean) => void): void {
        _initHandler = initHandler;
    }

    /**
     * init bridge, shall only call once on start
     * @param debug
     */
    //% weight=100
    //% block="init ra:bit with serial debug? $debug"
    export function initRabitBLE(debug: boolean): void {
        isDebug = debug;
        if(isDebug){
            serial.redirectToUSB();
            serial.setBaudRate(BaudRate.BaudRate115200);
        }
        if (isConnected) {
            return
        }
        
        bluetooth.startUartService();

        bluetooth.onBluetoothConnected(() => {
            isConnected = true;
            bluetooth.uartWriteString(MSG_INIT_T);
            if(isDebug){
                serial.writeLine("onBluetoothConnected")
            }
        });

        bluetooth.onBluetoothDisconnected(() => {
            isConnected = false;
            if (_initHandler != null) {
                _initHandler(false)
            }
            if(isDebug){
                serial.writeLine("onBluetoothDisconnected")
            }
        });

        bluetooth.onUartDataReceived(UART_DELIMITER, () => {
            onDataReceive()
        });

        if (_initHandler != null) {
            _initHandler(false)
        }
    }

    /**
     * send HTTP request, handle callback by event id
     * @param eventId 
     * @param httpMethod 
     * @param url 
     * @param headers 
     * @param body 
     * @param path
     */
    //% block="send HTTP request with Event ID $eventId using Method $httpMethod to URL $url with optional Header $headers with optional Body $body with optional path $path"
    export function sendHttpRequest(eventId: string, httpMethod: HttpMethods, url: string, headers: string, body: string, path: string): void {
        let handler: any = callbacks[eventId];
        if (handler) {
            bluetooth.uartWriteLine(`${MSG_HTTP_T}:${sterile(eventId)}:${httpMethod}:${sterile(url)}:${sterileReplace(headers)}:${sterileReplace(body)}:${sterileReplace(path)}`);
        }
    }

    /**
     * event handler of http/mqtt/network result, for repeatative http calls
     * @param eventId 
     * @param handler 
     */
    //% block="on result for event ID $eventId"
    export function setNetworkEventHandler(eventId:string, handler: (status: number, payload: string) => void): void {
        callbacks[eventId] = handler;
    }

    /**
     * subscribe MQTT topic, topic become event id
     * @param topic
     * @param handler
     */
    //% block="subscribe MQTT $topic"
    export function subscribeMqtt(topic: string, handler: (status: number, payload: string) => void): void {
        callbacks[topic] = handler;
        let msg = `${MSG_MQTT_SUB_T}:${sterile(topic)}`;
        bluetooth.uartWriteLine(msg);
        subscriptions.push(msg);
    }

    /**
     * publish MQTT message (MQTT is implemented on mobile)
     * @param t
     * @param m
     */
    //% block="publish MQTT message topic $t, with message $m"
    export function publishMqttMessage(t: string, m: string): void {
        bluetooth.uartWriteLine(`${MSG_MQTT_PUB_T}:${sterile(t)}:${sterile(m)}`)
    }

    /**
     * subscribe local topic, topic become event id
     * @param topic
     * @param handler
     */
    //% block="subscribe local topic $topic"
    export function subscribeLocal(topic: string, handler: (status: number, payload: string) => void): void {
        callbacks[topic] = handler;
        let msg = `${MSG_LAN_SUB_T}:${sterile(topic)}`;
        bluetooth.uartWriteLine(msg);
        subscriptions.push(msg);
    }

    /**v
     * publish local message (send through mobile)
     * @param t
     * @param m
     */
    //% block="publish local message topic $topTopic, with $m"
    export function publishLanMessage(t: string, m: string): void {
        bluetooth.uartWriteLine(`${MSG_LAN_PUB_T}:${sterile(t)}:${sterileReplace(m)}`)
    }

    // /**
    //  * publish WhenGate message, via HTTP, message can be encoded in any format matching the your gate design
    //  * @param eventId 
    //  * @param gateId
    //  * @param secret
    //  * @param withMessage
    //  */
    // //% block="publish WhenGate message with eventId $eventId to gate $gateId, secret $secret, with message $withMessage"
    // export function publishWhenGateMessage(eventId: string, gateId: string, secret: string, withMessage: string): void {
    //     bluetooth.uartWriteLine(`${MSG_WHENGATE_T}:${sterile(eventId)}:${gateId}|${secret}:${sterile(withMessage)}`)
    // }

    /**
     * publish adafruit IO message, via HTTP, message can be encoded in any format matching the your gate design
     * @param eventId 
     * @param username
     * @param aiokey
     * @param feedkey
     * @param value
     */
    //% block="publish adafruit IO message with eventId $eventId, for user $username, aiokey $aiokey, feedkey $feedkey with value $value"
    export function publishAdafruitIO(eventId: string, username: string, aiokey: string, feedkey: string, value: string): void {
        bluetooth.uartWriteLine(`${MSG_ADAFRUIT_T}:${sterile(eventId)}:${username}|${aiokey}|${feedkey}:${sterileReplace(value)}`)
    }

    /**
     * send custom notification (please complete account auth on your bluetooth bridge side)
     * @param eventId
     * @param method 
     * @param recipient 
     * @param template 
     * @param data
     */
    //% topblock=false
    //% handlerStatement=true
    //% block="send courier message with eventid $eventId by method $method to recipient $recipient using template $template with URL encoded data: $data"
    export function notificationSend(eventId: string, method: string, recipient: string, template: string, data: string): void{
        bluetooth.uartWriteLine(`${MSG_COURIER_T}:${sterile(eventId)}:${method}:${sterile(recipient)}:${sterile(template)}:${sterileReplace(data)}`)
    }
    
}