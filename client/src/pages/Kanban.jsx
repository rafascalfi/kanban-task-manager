import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Plus, MoreVertical } from 'lucide-react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import TaskCard from '../components/TaskCard';
import Modal from '../components/ui/Modal';

const columns = [
  { id: 'A Fazer', title: 'A Fazer', color: 'bg-gray-100' },
  { id: 'Em Andamento', title: 'Em Andamento', color: 'bg-blue-100' },
  { id: 'Revisão', title: 'Revisão', color: 'bg-purple-100' },
  { id: 'Concluído', title: 'Concluído', color: 'bg-green-100' },
];

const Kanban = () => {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'Média',
    status: 'A Fazer',
    deadline: '',
    category_id: '',
    tags: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = async () => {
    try {
      const [tasksRes, catsRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/categories')
      ]);
      setTasks(tasksRes.data);
      setCategories(catsRes.data);
      if (catsRes.data.length > 0 && !newTask.category_id) {
        setNewTask(prev => ({ ...prev, category_id: catsRes.data[0].id }));
      }
    } catch (error) {
      console.error("Erro ao buscar dados", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveTask(tasks.find(t => t.id === active.id));
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    const overId = over.id;

    // Check if dropped over a column or another task
    let newStatus = activeTask.status;
    const isOverColumn = columns.find(c => c.id === overId);
    
    if (isOverColumn) {
      newStatus = overId;
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    if (newStatus !== activeTask.status) {
      try {
        await api.put(`/tasks/${activeTask.id}`, { ...activeTask, status: newStatus });
        setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, status: newStatus } : t));
      } catch (error) {
        console.error("Erro ao atualizar status da tarefa", error);
      }
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const taskData = {
      ...newTask,
      tags: newTask.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    };

    try {
      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, taskData);
      } else {
        await api.post('/tasks', taskData);
      }
      setIsModalOpen(false);
      setEditingTask(null);
      setNewTask({ 
        title: '', 
        description: '', 
        priority: 'Média', 
        status: 'A Fazer', 
        deadline: '',
        category_id: categories[0]?.id || '',
        tags: ''
      });
      fetchData();
    } catch (error) {
      console.error("Erro ao processar tarefa", error);
    }
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      status: task.status,
      deadline: task.deadline || '',
      category_id: task.category_id || categories[0]?.id || '',
      tags: task.tags ? task.tags.join(', ') : ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quadro Kanban</h1>
          <p className="text-gray-500">Gerencie suas tarefas visualmente.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} /> Nova Tarefa
        </button>
      </div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4 h-full">
          {columns.map((col) => (
            <div key={col.id} className="min-w-[300px] flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color.replace('bg-', 'bg-dot-')}`} style={{backgroundColor: col.color.includes('gray') ? '#9ca3af' : col.color.includes('blue') ? '#3b82f6' : col.color.includes('purple') ? '#a855f7' : '#22c55e'}}></div>
                  <h2 className="font-semibold text-gray-700">{col.title}</h2>
                  <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                    {tasks.filter(t => t.status === col.id).length}
                  </span>
                </div>
                <MoreVertical size={16} className="text-gray-400 cursor-pointer" />
              </div>

              <SortableContext 
                id={col.id}
                items={tasks.filter(t => t.status === col.id).map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div 
                  className="flex flex-col gap-3 min-h-[500px] bg-gray-50/50 p-2 rounded-xl border border-dashed border-gray-200"
                >
                  {tasks.filter(t => t.status === col.id).map((task) => (
                    <div key={task.id} onDoubleClick={() => openEditModal(task)}>
                      <TaskCard task={task} />
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                        setNewTask(prev => ({ ...prev, status: col.id }));
                        setIsModalOpen(true);
                    }}
                    className="w-full py-2 text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all flex items-center justify-center gap-2 mt-auto"
                  >
                    <Plus size={14} /> Adicionar cartão
                  </button>
                </div>
              </SortableContext>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
        }} 
        title={editingTask ? "Editar Tarefa" : "Nova Tarefa"}
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input 
              type="text" 
              required
              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={newTask.title}
              onChange={e => setNewTask({...newTask, title: e.target.value})}
              placeholder="O que precisa ser feito?"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Descrição</label>
            <textarea 
              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              value={newTask.description}
              onChange={e => setNewTask({...newTask, description: e.target.value})}
              placeholder="Detalhes da tarefa..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Prioridade</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={newTask.priority}
                onChange={e => setNewTask({...newTask, priority: e.target.value})}
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Categoria</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={newTask.category_id}
                onChange={e => setNewTask({...newTask, category_id: e.target.value})}
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data Limite</label>
              <input 
                type="date" 
                className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={newTask.deadline}
                onChange={e => setNewTask({...newTask, deadline: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tags (separadas por vírgula)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={newTask.tags}
              onChange={e => setNewTask({...newTask, tags: e.target.value})}
              placeholder="ex: urgente, bug, pessoal"
            />
          </div>
          <div className="pt-4 flex gap-3">
            {editingTask && (
              <button 
                type="button"
                onClick={async () => {
                  if (window.confirm('Tem certeza que deseja excluir esta tarefa?')) {
                    await api.delete(`/tasks/${editingTask.id}`);
                    setIsModalOpen(false);
                    setEditingTask(null);
                    fetchData();
                  }
                }}
                className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg font-semibold hover:bg-red-100 transition-colors"
              >
                Excluir
              </button>
            )}
            <button 
              type="submit" 
              className={`flex-[2] bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200`}
            >
              {editingTask ? "Salvar Alterações" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Kanban;
