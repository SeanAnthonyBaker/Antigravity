import './App.css'
import { NodeTree } from './components/NodeTree'
import { ThemeToggle } from './components/ThemeToggle'
import bannerImage from './assets/tulkah-banner.png'

function App() {
  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <img
          src={bannerImage}
          alt="Tulkah AI - Embedding AI driven innovation & productivity"
          style={{
            width: '100%',
            maxWidth: '800px',
            height: 'auto',
            borderRadius: '8px'
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Node Hierarchy Manager</h1>
        <ThemeToggle />
      </div>
      <NodeTree />
    </>
  )
}

export default App
