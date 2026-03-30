import styles from './styles.module.css'

export type ComparisonRow = {
  feature: string
  ours: string
  competitor: string
}

type ComparisonTableProps = {
  title?: string
  rows: ComparisonRow[]
}

export function ComparisonTable({ title = 'Comparacion real', rows }: ComparisonTableProps) {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={styles.comparisonCard}>
          <table className={styles.comparisonTable}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Nosotros (Drenvex)</th>
                <th>Competencia barata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.feature}>
                  <td>{row.feature}</td>
                  <td className={styles.ours}>{row.ours}</td>
                  <td className={styles.competitor}>{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
