import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Play, Square, RefreshCw, Check } from 'lucide-react';
import { clsx } from 'clsx';

type VoiceState = 'idle' | 'recording' | 'preview' | 'error';

interface Props {
    onRecordingComplete: (file: File) => void;
    onCancel: () => void;
}

export const VoiceRecorder: React.FC<Props> = ({ onRecordingComplete, onCancel }) => {
    const [state, setState] = useState<VoiceState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    // Web Audio API refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>();
    const [volumes, setVolumes] = useState<number[]>(new Array(32).fill(0));

    const MAX_TIME = 300; // 5 minutes

    useEffect(() => {
        return () => cleanup();
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (state === 'recording') {
            interval = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= MAX_TIME - 1) {
                        stopRecording();
                        return MAX_TIME;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [state]);

    const cleanup = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close().catch(console.error);
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
    };

    const drawWaveform = () => {
        if (!analyserRef.current || state !== 'recording') return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Sample 32 points from the frequency data
        const step = Math.floor(dataArray.length / 32);
        const newVolumes = [];
        for (let i = 0; i < 32; i++) {
            // Normalize 0-255 to 0-100%
            newVolumes.push((dataArray[i * step] / 255) * 100);
        }
        setVolumes(newVolumes);

        animationFrameRef.current = requestAnimationFrame(drawWaveform);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Setup Web Audio API for visualization
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Setup MediaRecorder
            const options = MediaRecorder.isTypeSupported('audio/webm')
                ? { mimeType: 'audio/webm' }
                : { mimeType: 'audio/ogg' };

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
                const url = URL.createObjectURL(audioBlob);
                setAudioUrl(url);
                setState('preview');
                cleanup(); // Release microphone
            };

            mediaRecorder.start();
            setState('recording');
            setRecordingTime(0);
            drawWaveform();

        } catch (err: any) {
            console.error('Microphone exact error:', err);
            setState('error');
            setErrorMessage(err.message || 'Microphone access denied');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleUseRecording = () => {
        if (audioChunksRef.current.length === 0) return;
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
        const file = new File([blob], `voice-note-${Date.now()}.${blob.type.split('/')[1] || 'webm'}`, { type: blob.type });
        onRecordingComplete(file);
    };

    const handleRerecord = () => {
        cleanup();
        setAudioUrl(null);
        setAudioChunksRef([]);
        setState('idle');
    };

    const setAudioChunksRef = (val: Blob[]) => { audioChunksRef.current = val; };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full bg-surface border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px]">

            {state === 'error' && (
                <div className="flex flex-col items-center text-center text-red-400">
                    <MicOff size={48} className="mb-4 opacity-50" />
                    <p className="font-bold mb-1">Microphone Access Denied</p>
                    <p className="text-xs opacity-70 mb-4">{errorMessage}</p>
                    <button onClick={onCancel} className="text-sm bg-white/10 px-4 py-2 rounded-full text-white">Cancel</button>
                </div>
            )}

            {state === 'idle' && (
                <div className="flex flex-col items-center">
                    <button
                        onClick={startRecording}
                        className="w-20 h-20 rounded-full bg-[#FF6B9D]/20 border border-[#FF6B9D]/40 flex items-center justify-center mb-4 transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,107,157,0.3)] animate-pulse"
                    >
                        <Mic size={32} className="text-[#FF6B9D]" />
                    </button>
                    <p className="text-white font-bold font-heading">Tap to Record</p>
                    <p className="text-xs text-text-secondary mt-1">Spatial Audio Voice Note</p>
                    <button onClick={onCancel} className="mt-6 text-sm text-text-secondary hover:text-white">Cancel</button>
                </div>
            )}

            {state === 'recording' && (
                <div className="flex flex-col items-center w-full">
                    <div className="flex items-end justify-center gap-1 h-32 w-full mb-6">
                        {volumes.map((vol, i) => (
                            <div
                                key={i}
                                className="w-2 bg-[#FF6B9D] rounded-t-full transition-all duration-75"
                                style={{ height: `${Math.max(4, vol)}%` }}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                        <span className="font-mono text-xl font-bold text-white">{formatTime(recordingTime)}</span>
                    </div>

                    <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                    >
                        <Square size={24} className="text-white fill-current" />
                    </button>
                </div>
            )}

            {state === 'preview' && (
                <div className="flex flex-col items-center w-full">
                    <div className="w-full bg-black/40 rounded-xl p-4 mb-6 border border-white/5">
                        {audioUrl && (
                            <audio controls src={audioUrl} className="w-full h-10 outline-none" />
                        )}
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        <button
                            onClick={handleUseRecording}
                            className="w-full bg-[#FF6B9D] hover:bg-[#FF6B9D]/90 text-white font-bold py-3 px-6 rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(255,107,157,0.4)] flex items-center justify-center gap-2"
                        >
                            <Check size={20} /> Use This Recording
                        </button>
                        <button
                            onClick={handleRerecord}
                            className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={20} /> Record Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
