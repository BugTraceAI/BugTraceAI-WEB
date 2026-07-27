// @author: Albert C | @yz9yt | github.com/yz9yt
// index.tsx
// version 0.1 Beta
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { ChatProvider } from './contexts/ChatContext.tsx';
import { AnalysisProvider } from './contexts/AnalysisContext.tsx';
import { SettingsProvider } from './contexts/SettingsProvider.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SettingsProvider>
          <ChatProvider>
            <AnalysisProvider>
              <App />
            </AnalysisProvider>
          </ChatProvider>
        </SettingsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
