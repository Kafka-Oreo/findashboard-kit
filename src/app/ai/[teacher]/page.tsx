'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

export default function AINotePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const teacher = params.teacher as string;
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const teacherInfo = {
    ma: {
      name: '马老师',
      title: '马老师',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    qian: {
      name: '钱老师',
      title: '钱多多',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)'
    }
  };

  const info = teacherInfo[teacher as keyof typeof teacherInfo] || teacherInfo.ma;

  useEffect(() => {
    generateNote();
  }, [teacher, date]);

  const generateNote = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/ai/generate-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teacher, date })
      });

      const data = await response.json();
      
      if (data.success) {
        setNote(data.data.content);
      } else {
        setError(data.error || '生成失败');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-secondary">
      {/* 顶部导航 */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回日报
          </button>
          <div className="text-sm text-text-muted">{date}</div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 老师信息卡片 */}
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            backgroundColor: info.bgColor,
            borderColor: info.borderColor
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: info.color }}
            >
              {info.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{info.name}</h1>
              <p className="text-sm" style={{ color: info.color }}>{info.title}</p>
            </div>
          </div>
        </div>

        {/* 笔记内容 */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: info.color, borderTopColor: 'transparent' }}></div>
              <p className="text-text-secondary">正在生成每日笔记...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={generateNote}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              重试
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-8">
            <div className="prose prose-invert max-w-none">
              {note.split('\n').map((line, index) => {
                if (line.startsWith('# ')) {
                  return <h1 key={index} className="text-2xl font-bold text-white mb-4 mt-6">{line.replace('# ', '')}</h1>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={index} className="text-xl font-semibold text-white mb-3 mt-5">{line.replace('## ', '')}</h2>;
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={index} className="font-semibold text-white mt-4 mb-2">{line.replace(/\*\*/g, '')}</p>;
                }
                if (line.startsWith('- ')) {
                  return <li key={index} className="ml-6 text-text-secondary mb-1">{line.replace('- ', '• ')}</li>;
                }
                if (line.startsWith('---')) {
                  return <hr key={index} className="border-border my-6" />;
                }
                if (line.startsWith('*') && line.endsWith('*')) {
                  return <p key={index} className="text-sm text-text-muted italic mt-4">{line.replace(/\*/g, '')}</p>;
                }
                if (line.trim() === '') {
                  return <br key={index} />;
                }
                return <p key={index} className="text-text-secondary mb-2 leading-relaxed">{line}</p>;
              })}
            </div>
          </div>
        )}

        {/* 底部操作 */}
        {!loading && !error && (
          <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={generateNote}
              className="px-6 py-2 border border-border hover:border-border text-text-secondary hover:text-white rounded-lg transition-all"
            >
              重新生成
            </button>
            <button
              onClick={() => {
                const blob = new Blob([note], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${info.name}_${date}_笔记.md`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-6 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: info.color }}
            >
              下载笔记
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
