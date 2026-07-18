import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge } from '@xyflow/react';
import { serializeGraph } from './wire';
import type { DeviceFlowNode, SimValue } from './types';

export type PiStatus = 'disconnected' | 'connecting' | 'connected';

const STORAGE_KEY = 'gpio-webapp.pi-address';
const DEFAULT_HOST = 'raspberrypi.local';
const DEFAULT_PORT = '8765';
const HISTORY_MAX = 6;

interface StoredLink {
  host: string;
  port: string;
  history: string[];
}

function loadStored(): StoredLink {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { host: DEFAULT_HOST, port: DEFAULT_PORT, history: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLink>;
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        host: typeof parsed.host === 'string' ? parsed.host : DEFAULT_HOST,
        port: typeof parsed.port === 'string' ? parsed.port : DEFAULT_PORT,
        history: Array.isArray(parsed.history)
          ? parsed.history.filter((h): h is string => typeof h === 'string')
          : [],
      };
    }
  } catch {
    // Legacy value: a plain "host:port" string (or a full ws:// URL).
    const sep = raw.lastIndexOf(':');
    if (sep > 0 && !raw.includes('://') && /^\d+$/.test(raw.slice(sep + 1))) {
      return { host: raw.slice(0, sep), port: raw.slice(sep + 1), history: [] };
    }
    return { host: raw, port: DEFAULT_PORT, history: [] };
  }
  return { host: DEFAULT_HOST, port: DEFAULT_PORT, history: [] };
}

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
 *
 * The host and port are persisted, along with a most-recent-first
 * history of hosts that have successfully connected (for the address
 * dropdown). A host containing "://" is used as the URL verbatim.
 */
export function usePiLink(
  nodes: DeviceFlowNode[],
  edges: Edge[],
  onError: (message: string) => void,
) {
  const [link, setLink] = useState(loadStored);
  const [status, setStatus] = useState<PiStatus>('disconnected');
  const [liveValues, setLiveValues] = useState<Record<string, SimValue>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentRef = useRef<string | null>(null);
  const intentionalCloseRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
  }, [link]);

  const setHost = useCallback(
    (host: string) => setLink((prev) => ({ ...prev, host })),
    [],
  );
  const setPort = useCallback(
    (port: string) => setLink((prev) => ({ ...prev, port })),
    [],
  );

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const host = link.host.trim();
    const url = host.includes('://')
      ? host
      : `ws://${host}:${link.port.trim() || DEFAULT_PORT}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      onError(`Invalid Pi address: ${url}`);
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
      setLink((prev) => ({
        ...prev,
        history: [host, ...prev.history.filter((h) => h !== host)].slice(
          0,
          HISTORY_MAX,
        ),
      }));
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
  }, [link.host, link.port, onError]);

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

  return {
    host: link.host,
    port: link.port,
    history: link.history,
    setHost,
    setPort,
    status,
    liveValues,
    connect,
    disconnect,
  };
}
