import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center px-12"
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        }}
      >
        <div className="max-w-md text-center">
          <div className="mb-8">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <span className="text-white text-3xl font-bold">S</span>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">{t('app.name')}</h1>
          <p className="text-xl text-blue-100 mb-8">{t('app.tagline')}</p>
          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { icon: '📊', label: 'Dashboard & Analytics' },
              { icon: '📦', label: 'Inventory Management' },
              { icon: '💰', label: 'Financial Accounting' },
              { icon: '🛒', label: 'Sales & Purchasing' },
              { icon: '🏪', label: 'Retail & POS' },
              { icon: '📋', label: 'Expense Management' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="text-white text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
