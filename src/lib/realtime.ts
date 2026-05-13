"use client";

import { authHeaders } from "@/lib/api-client";

export interface RealtimeSessionToken {
  client_secret: { value: string; expires_at?: number };
}

export interface TranscriptionCallbacks {
  /** First time a partial is seen for this item_id. Useful for snapshotting
   *  the current speaker + start time so they stay correct even if the user
   *  switches speakers mid-utterance. */
  onPartialStart?: (itemId: string) => void;
  onPartial?: (text: string, itemId: string) => void;
  onFinal?: (text: string, itemId: string) => void;
  onError?: (err: Error) => void;
  onStatus?: (status: string) => void;
}

export class RealtimeTranscriber {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private callbacks: TranscriptionCallbacks;
  private partials = new Map<string, string>();

  constructor(callbacks: TranscriptionCallbacks) {
    this.callbacks = callbacks;
  }

  async start(opts: {
    prompt?: string;
    language?: string;
    model?: string;
  }): Promise<void> {
    this.callbacks.onStatus?.("requesting-token");
    const tokenRes = await fetch("/api/realtime/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(opts),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`token endpoint failed: ${tokenRes.status} ${body}`);
    }
    const session = (await tokenRes.json()) as RealtimeSessionToken;
    const ephemeralKey = session.client_secret?.value;
    if (!ephemeralKey) {
      throw new Error("Realtime session response missing client_secret.value");
    }

    this.callbacks.onStatus?.("requesting-microphone");
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    });

    this.callbacks.onStatus?.("connecting");
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.oniceconnectionstatechange = () => {
      this.callbacks.onStatus?.(`ice:${pc.iceConnectionState}`);
    };
    pc.onconnectionstatechange = () => {
      this.callbacks.onStatus?.(`pc:${pc.connectionState}`);
    };

    for (const track of this.localStream.getAudioTracks()) {
      pc.addTrack(track, this.localStream);
    }

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.onopen = () => this.callbacks.onStatus?.("datachannel-open");
    dc.onclose = () => this.callbacks.onStatus?.("datachannel-closed");
    dc.onerror = (ev) =>
      this.callbacks.onError?.(
        new Error(`datachannel error: ${(ev as Event).type}`),
      );
    dc.onmessage = (ev) => this.handleEvent(ev.data);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpRes = await fetch(
      `https://api.openai.com/v1/realtime?intent=transcription`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp ?? "",
      },
    );
    if (!sdpRes.ok) {
      const body = await sdpRes.text();
      throw new Error(`SDP exchange failed: ${sdpRes.status} ${body}`);
    }
    const answerSdp = await sdpRes.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    this.callbacks.onStatus?.("connected");
  }

  stop(): void {
    // Flush any in-flight partials as "needs review" final segments so we
    // don't lose the last utterance when the user clicks stop.
    for (const [itemId, text] of this.partials) {
      if (text.trim()) {
        try {
          this.callbacks.onFinal?.(text, itemId);
        } catch {
          /* noop */
        }
      }
    }
    this.partials.clear();
    try {
      this.dc?.close();
    } catch {
      /* noop */
    }
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop());
      this.pc?.close();
    } catch {
      /* noop */
    }
    try {
      this.localStream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* noop */
    }
    this.dc = null;
    this.pc = null;
    this.localStream = null;
    this.callbacks.onStatus?.("stopped");
  }

  private handleEvent(data: unknown): void {
    if (typeof data !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    const type = msg.type as string | undefined;
    if (!type) return;

    if (type === "conversation.item.input_audio_transcription.delta") {
      const itemId = (msg.item_id as string | undefined) ?? "live";
      const delta = (msg.delta as string | undefined) ?? "";
      const prev = this.partials.get(itemId);
      if (prev === undefined) this.callbacks.onPartialStart?.(itemId);
      const next = (prev ?? "") + delta;
      this.partials.set(itemId, next);
      this.callbacks.onPartial?.(next, itemId);
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const itemId = (msg.item_id as string | undefined) ?? "live";
      const text =
        (msg.transcript as string | undefined) ??
        this.partials.get(itemId) ??
        "";
      this.partials.delete(itemId);
      this.callbacks.onFinal?.(text, itemId);
      return;
    }

    if (type === "error") {
      const err = (msg.error as { message?: string } | undefined)?.message;
      this.callbacks.onError?.(new Error(err ?? "Realtime API error"));
    }
  }
}
