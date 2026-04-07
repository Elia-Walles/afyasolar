// Simple logger utility that can be enhanced with more features if needed

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
  timestamp: string;
}

export const logger = {
  info: (message: string, data?: any) => {
    const entry: LogEntry = {
      level: 'info',
      message,
      data,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(entry));
  },
  
  warn: (message: string, data?: any) => {
    const entry: LogEntry = {
      level: 'warn',
      message,
      data,
      timestamp: new Date().toISOString()
    };
    console.warn(JSON.stringify(entry));
  },
  
  error: (message: string, error?: any) => {
    const entry: LogEntry = {
      level: 'error',
      message,
      data: error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(entry));
  }
};

export default logger;
