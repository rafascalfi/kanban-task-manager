import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle, Clock, AlertCircle, List } from 'lucide-react';
import api from '../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState({ total: 0, completedToday: 0, late: 0 });
  const [recentTasks, setRecentTasks] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, tasksRes] = await Promise.all([
          api.get('/stats'),
          api.get('/tasks')
        ]);
        
        setStats(statsRes.data);
        setRecentTasks(tasksRes.data.slice(0, 5));
        
        if (statsRes.data.byCategory && statsRes.data.byCategory.length > 0) {
          setChartData(statsRes.data.byCategory.map(cat => ({
            name: cat.name,
            total: cat.count
          })));
        } else {
          setChartData([
            { name: 'Trabalho', total: 0 },
            { name: 'Casa', total: 0 },
            { name: 'Estudos', total: 0 },
          ]);
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas", error);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total de Tarefas', value: stats.total, icon: <List className="text-blue-500" />, color: 'bg-blue-50' },
    { title: 'Concluídas Hoje', value: stats.completedToday, icon: <CheckCircle className="text-green-500" />, color: 'bg-green-50' },
    { title: 'Atrasadas', value: stats.late, icon: <Clock className="text-red-500" />, color: 'bg-red-50' },
    { title: 'Prioridade Alta', value: 0, icon: <AlertCircle className="text-orange-500" />, color: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Bem-vindo de volta! Aqui está o resumo da sua vida.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
              <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 p-6">
          <CardHeader>
            <CardTitle>Produtividade por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle>Tarefas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTasks.length > 0 ? recentTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className={`w-2 h-2 rounded-full ${task.status === 'Concluído' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <p className="text-xs text-gray-500">{task.category_name}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-500 text-center py-8">Nenhuma tarefa recente.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
