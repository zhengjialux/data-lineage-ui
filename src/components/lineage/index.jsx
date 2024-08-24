import LineageProvider from './LineageProvider.jsx'
import LineageApp from './LineageApp.jsx'

const Lineage = () => {
    return (
        <LineageProvider>
          <LineageApp />
        </LineageProvider>
    )
}

export default Lineage