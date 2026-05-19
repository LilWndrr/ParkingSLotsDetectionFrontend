import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

/**
 * Custom hook that manages a STOMP WebSocket connection.
 *
 * @param {function} onMessage - callback invoked with each message body
 *   Message shape: { parkingName, groundLevelName, slotId, isEmpty }
 * @returns {{ connected: boolean, connect: function, disconnect: function }}
 */
export default function useWebSocket(onMessage) {
  const clientRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (clientRef.current?.active) return;

    const API_URL = (import.meta.env.VITE_PUBLIC_API_URL || '').trim();
    const wsUrl = API_URL ? `${API_URL}/ws` : '/ws';

    const client = new Client({
      webSocketFactory: () => new SockJS(wsUrl),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},

      onConnect: () => {
        setConnected(true);
        client.subscribe('/topic/parking-updates', (frame) => {
          try {
            const body = JSON.parse(frame.body);
            onMessageRef.current?.(body);
          } catch (e) {
            console.error('Failed to parse WS message:', e);
          }
        });
      },

      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers?.message);
        setConnected(false);
      },

      onDisconnect: () => {
        setConnected(false);
      },

      onWebSocketClose: () => {
        setConnected(false);
      },
    });

    clientRef.current = client;
    client.activate();
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current?.active) {
      clientRef.current.deactivate();
      clientRef.current = null;
      setConnected(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current?.active) {
        clientRef.current.deactivate();
      }
    };
  }, []);

  return { connected, connect, disconnect };
}
