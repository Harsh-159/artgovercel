import React from 'react';
import { Box } from 'lucide-react';

interface Props {
    file: File;
}

export const ModelPreview: React.FC<Props> = ({ file }) => {
    const formatSize = (bytes: number) => {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <div className="w-full bg-surface border border-white/10 rounded-xl p-6 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FFD1]/10 rounded-full blur-3xl" />

            <div className="w-16 h-16 rounded-2xl bg-[#00FFD1]/20 border border-[#00FFD1]/40 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(0,255,209,0.3)]">
                <Box size={32} className="text-[#00FFD1]" />
            </div>

            <div className="flex-1 min-w-0 z-10">
                <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#00FFD1]/20 text-[#00FFD1] text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-[#00FFD1]/30">
                        3D Model Ready
                    </span>
                </div>
                <h3 className="text-white font-bold truncate text-sm">{file.name}</h3>
                <p className="text-text-secondary text-xs mt-1">{formatSize(file.size)}</p>
                <p className="text-[#00FFD1]/70 text-[10px] mt-2 italic">Will appear as a rotating 3D object in AR</p>
            </div>
        </div>
    );
};
