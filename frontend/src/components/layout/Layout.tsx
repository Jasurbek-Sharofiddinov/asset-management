import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen bg-vault-black">
      <Sidebar />
      <div className="lg:ml-[220px] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 px-6 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
