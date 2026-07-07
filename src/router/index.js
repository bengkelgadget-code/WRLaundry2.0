import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView
    },
    {
      path: '/admin',
      component: () => import('../views/AdminView.vue'),
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../views/DashboardView.vue')
        },
        {
          path: 'produksi',
          name: 'admin-produksi',
          component: () => import('../views/ProduksiView.vue')
        },
        {
          path: 'pengaturan',
          name: 'admin-pengaturan',
          component: () => import('../views/PengaturanView.vue')
        },
        {
          path: ':sheet',
          name: 'admin-master',
          component: () => import('../views/MasterDataView.vue')
        },
        {
          path: 'staff',
          name: 'admin-staff',
          component: () => import('../views/StaffView.vue')
        }
      ]
    },
    {
      path: '/staff',
      redirect: '/admin/staff'
    }
  ]
});

// Setup auth guard
router.beforeEach((to, from) => {
  const userStr = localStorage.getItem('zettbotUserAuth');
  if (to.name !== 'login' && !userStr) {
    return { name: 'login' };
  }
  
  if (userStr && to.name !== 'login') {
    try {
      const user = JSON.parse(userStr);
      if (String(user.Role).toUpperCase() === 'STAFF' && to.path !== '/admin/staff') {
        return '/admin/staff';
      }
    } catch(e) {}
  }
});

export default router;
