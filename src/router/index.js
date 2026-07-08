import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import AdminView from '../views/AdminView.vue';
import DashboardView from '../views/DashboardView.vue';
import ProduksiView from '../views/ProduksiView.vue';
import PengaturanView from '../views/PengaturanView.vue';
import StaffView from '../views/StaffView.vue';
import MasterDataView from '../views/MasterDataView.vue';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView
    },
    {
      path: '/admin',
      component: AdminView,
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: DashboardView
        },
        {
          path: 'produksi',
          name: 'admin-produksi',
          component: ProduksiView
        },
        {
          path: 'pengaturan',
          name: 'admin-pengaturan',
          component: PengaturanView
        },
        {
          path: 'staff',
          name: 'admin-staff',
          component: StaffView
        },
        {
          path: ':sheet',
          name: 'admin-master',
          component: MasterDataView
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
router.beforeEach(async (to, from) => {
  const userStr = localStorage.getItem('zettbotUserAuth');
  
  if (to.name !== 'login' && !userStr) {
    return { name: 'login' };
  }
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const { useAppStore } = await import('../stores/useAppStore');
      const store = useAppStore();
      store.currentUser = user;
      
      // If navigating to login but already logged in, redirect to dashboard
      if (to.name === 'login' || to.path === '/') {
          if (String(user.Role).toUpperCase() === 'STAFF') {
              return '/admin/staff';
          } else {
              return '/admin';
          }
      }
      
      if (String(user.Role).toUpperCase() === 'STAFF' && to.path !== '/admin/staff') {
        return '/admin/staff';
      }
    } catch(e) {
      // If parsing fails, force login
      if (to.name !== 'login') return { name: 'login' };
    }
  }
});

export default router;
