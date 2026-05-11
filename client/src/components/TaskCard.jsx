import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from './ui/Card';
import { Tag } from 'lucide-react';

const TaskCard = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgente': return 'bg-red-100 text-red-700';
      case 'Média': return 'bg-orange-100 text-orange-700';
      case 'Baixa': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors">
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            <div className="flex flex-wrap gap-1 justify-end">
              {task.tags && task.tags.map((tag, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-md border border-gray-200">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <h4 className="font-medium text-gray-900">{task.title}</h4>
          <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1 text-gray-400">
              <Tag size={12} />
              <span className="text-xs">{task.category_name || 'Geral'}</span>
            </div>
            {task.deadline && (
               <span className="text-[10px] text-gray-400">{new Date(task.deadline).toLocaleDateString()}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskCard;
