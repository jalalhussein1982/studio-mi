import React from 'react';

interface LoadingOverlayProps {
  message?: string;
  isVisible: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
        <div className="loader mb-4"></div>
        <h3 className="text-lg font-semibold text-gray-800 text-center animate-pulse">
          {message || 'Processing...'}
        </h3>
      </div>
    </div>
  );
};
