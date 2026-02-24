import WebSocket from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { Readable, PassThrough } from 'stream';
import config from '../config/env.js';

// Set ffmpeg path explicitly for ffmpeg-static (Force cast to string)
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
} else {
  console.error('[VoiceManager] FFmpeg binary not found!');
}

interface VoiceSessionConfig {
  voice: 'Eve' | 'Ara';
  outputFormat: 'pcm_24000';
}

export class VoiceManager {
  private ws: WebSocket | null = null;
  private sessionConfig: VoiceSessionConfig = {
    voice: 'Eve',
    outputFormat: 'pcm_24000'
  };
  private isConnected = false;

  constructor() {}

  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        return resolve();
      }

      console.log(`[VoiceManager] Connecting to wss://api.x.ai/v1/realtime with key: ${config.GROK_API_KEY ? 'FOUND' : 'MISSING'}`);

      this.ws = new WebSocket('wss://api.x.ai/v1/realtime', {
        headers: {
          Authorization: `Bearer ${config.GROK_API_KEY}`
        }
      });

      this.ws.on('open', () => {
        console.log('[VoiceManager] WebSocket Connected');
        this.isConnected = true;
        this.configureSession();
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error('[VoiceManager] WebSocket Error (Full):', JSON.stringify(err, Object.getOwnPropertyNames(err)));
        this.isConnected = false;
        reject(err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[VoiceManager] WebSocket Closed. Code: ${code}, Reason: ${reason}`);
        this.isConnected = false;
      });
    });
  }

  private configureSession() {
    if (!this.ws) return;
    console.log('[VoiceManager] Configuring Session...');
    
    const configPayload = {
      type: 'session.update',
      session: {
        voice: this.sessionConfig.voice,
        turn_detection: null, // Manual turn detection for async voice notes
        input_audio_transcription: { model: 'grok-2-audio' },
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24000 }
          },
          output: {
            format: { type: 'audio/pcm', rate: 24000 }
          }
        }
      }
    };
    
    this.ws.send(JSON.stringify(configPayload));
  }

  public async processVoiceMessage(oggBuffer: Buffer): Promise<Buffer> {
    await this.connect();

    return new Promise(async (resolve, reject) => {
      const pcmBuffer = await this.convertOggToPcm(oggBuffer);
      const audioChunks: Buffer[] = [];

      if (!this.ws) return reject('WebSocket not initialized');

      // Setup one-time listener for this specific turn
      const messageHandler = (data: WebSocket.Data) => {
        const event = JSON.parse(data.toString());

        if (event.type === 'response.output_audio.delta') {
          audioChunks.push(Buffer.from(event.delta, 'base64'));
        }

        if (event.type === 'response.output_audio.done') {
          // Turn finished
          this.ws?.off('message', messageHandler);
          const fullPcm = Buffer.concat(audioChunks);
          this.convertPcmToOgg(fullPcm).then(resolve).catch(reject);
        }

        if (event.type === 'error') {
           console.error('[VoiceManager] API Error:', event);
           this.ws?.off('message', messageHandler);
           reject(event.message);
        }
      };

      this.ws.on('message', messageHandler);

      // Send Audio
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcmBuffer.toString('base64')
      }));

      this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      this.ws.send(JSON.stringify({ type: 'response.create' }));
    });
  }

  public async generateVoiceResponse(text: string): Promise<Buffer> {
    console.log(`[VoiceManager] Generating voice for text: "${text}"`);
    await this.connect();

    return new Promise(async (resolve, reject) => {
      const audioChunks: Buffer[] = [];
      if (!this.ws) return reject('WebSocket not initialized');

      const messageHandler = (data: WebSocket.Data) => {
        const raw = data.toString();
        const event = JSON.parse(raw);
        
        // Verbose logging for non-audio events
        if (event.type !== 'response.output_audio.delta') {
            console.log(`[VoiceManager] WS Event: ${event.type}`);
        }

        if (event.type === 'response.output_audio.delta') {
          audioChunks.push(Buffer.from(event.delta, 'base64'));
        }

        if (event.type === 'response.output_audio.done') {
          console.log(`[VoiceManager] Audio Done. Chunks: ${audioChunks.length}`);
          this.ws?.off('message', messageHandler);
          const fullPcm = Buffer.concat(audioChunks);
          console.log(`[VoiceManager] Converting PCM to OGG (Size: ${fullPcm.length})`);
          this.convertPcmToOgg(fullPcm)
            .then(buf => {
                console.log(`[VoiceManager] OGG Conversion Complete (Size: ${buf.length})`);
                resolve(buf);
            })
            .catch(err => {
                console.error('[VoiceManager] OGG Conversion Failed:', err);
                reject(err);
            });
        }
        
        if (event.type === 'error') {
           console.error('[VoiceManager] API Error:', event);
           this.ws?.off('message', messageHandler);
           reject(event.message);
        }
      };

      this.ws.on('message', messageHandler);

      // Send Text instead of Audio
      this.ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: text }]
        }
      }));

      console.log('[VoiceManager] Sent conversation.item.create');
      this.ws.send(JSON.stringify({ type: 'response.create' }));
      console.log('[VoiceManager] Sent response.create');
    });
  }

  private convertOggToPcm(oggBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(oggBuffer);
      inputStream.push(null);

      const chunks: Buffer[] = [];
      const outputStream = new PassThrough();
      
      outputStream.on('data', (chunk) => chunks.push(chunk));
      outputStream.on('end', () => resolve(Buffer.concat(chunks)));

      ffmpeg(inputStream)
        .inputFormat('ogg')
        .audioFrequency(24000)
        .audioChannels(1)
        .format('s16le') // PCM 16-bit little-endian
        .on('error', (err: Error) => reject(err))
        .pipe(outputStream);
    });
  }

  private convertPcmToOgg(pcmBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(pcmBuffer);
      inputStream.push(null);

      const chunks: Buffer[] = [];
      const outputStream = new PassThrough();
      
      outputStream.on('data', (chunk) => chunks.push(chunk));
      outputStream.on('end', () => resolve(Buffer.concat(chunks)));

      ffmpeg(inputStream)
        .inputFormat('s16le')
        .inputOptions([
          '-ar 24000',
          '-ac 1'
        ])
        .audioFrequency(48000) // Telegram standard
        .audioChannels(1)
        .format('ogg')
        .audioCodec('libopus')
        .on('error', (err: Error) => reject(err))
        .pipe(outputStream);
    });
  }
}

export const voiceManager = new VoiceManager();
