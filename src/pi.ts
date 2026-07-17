import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { serializeGraph } from './wire';
import type { DeviceFlowNode, SimValue } from './types';

export type PiStatus = 'disconnected' | 'connecting' | 'connected';

const STORAGE_KEY = 'gpio-webapp.pi-address';

interface AgentMessage {
  type: string;
  values?: Record<string, SimValue>;
  errors?: { nodeId: string | null; message: string }[];
}

/**
 * Live link to the Pi agent (agent/gpio_agent.py). While connected, the
 * serialized graph is sent whenever it changes (debounced, and only
 * when the wire payload differs, so drags don't resend), and the
 * agent's 10Hz stream of real device values is collected for display.
 */
export function usePiLink(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  onError: (message: string) => void,
) {
  const [address, setAddress] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '192.168.86.220:8765',
  );
  const [status, setStatus] = useState<PiStatus>('disconnected');
  const [liveValues, setLiveValues] = useState<Record<string, SimValue>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const url = address.includes('://') ? address : `ws://${address}`;
    localStorage.setItem(STORAGE_KEY, address);
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      onError(`Invalid Pi address: ${address}`);
      return;
    }
    wsRef.current = ws;
    intentionalCloseRef.current = false;
    setStatus('connecting');
    let opened = false;
    ws.onopen = () => {
      opened = true;
      lastSentRef.current = null; // send the full graph afresh
      setStatus('connected');
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as AgentMessage;
      if (msg.type === 'values' && msg.values) {
        setLiveValues((prev) => ({ ...prev, ...msg.values }));
      } else if (msg.type === 'applied' && msg.errors?.length) {
        onError(`Pi: ${msg.errors.map((e) => e.message).join('; ')}`);
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
      lastSentRef.current = null;
      setStatus('disconnected');
      setLiveValues({});
      if (!opened) onError(`Could not connect to ${url}`);
      else if (!intentionalCloseRef.current) onError('Pi connection lost');
    };
  }, [address, onError]);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    wsRef.current?.close();
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  useEffect(() => {
    if (status !== 'connected') return;
    const payload = JSON.stringify(serializeGraph(nodes, edges));
    if (payload === lastSentRef.current) return;
    const timer = setTimeout(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(payload);
        lastSentRef.current = payload;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [nodes, edges, status]);

  return { address, setAddress, status, liveValues, connect, disconnect };
}
