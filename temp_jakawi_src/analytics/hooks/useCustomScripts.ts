import { useEffect } from 'react'

// Funcion cirujana para inyectar HTML y forzar la ejecucion de <script>
const injectScripts = (htmlString: string, targetElement: HTMLElement) => {
  if (!htmlString || htmlString.trim() === '') return

  const template = document.createElement('template')
  template.innerHTML = htmlString.trim()

  const nodes = Array.from(template.content.childNodes)

  nodes.forEach((node) => {
    // Si es un script, tenemos que recrearlo desde cero para que el navegador lo ejecute.
    if (node.nodeName.toLowerCase() === 'script') {
      const scriptElement = document.createElement('script')
      const originalScript = node as HTMLScriptElement

      // Copiar todos los atributos (src, async, defer, id, etc).
      Array.from(originalScript.attributes).forEach((attr) => {
        scriptElement.setAttribute(attr.name, attr.value)
      })

      // Copiar el contenido interno (si es un script en linea).
      scriptElement.text = originalScript.text

      targetElement.appendChild(scriptElement)
    } else {
      // Si es un <div>, <noscript>, <style> u otro nodo, lo clonamos tal cual.
      targetElement.appendChild(node.cloneNode(true))
    }
  })
}

export const useCustomScripts = (headScript: string | null, footerScript: string | null) => {
  useEffect(() => {
    // 1. Inyectar scripts del Head.
    if (headScript) {
      injectScripts(headScript, document.head)
    }

    // 2. Inyectar scripts del Footer (Body).
    if (footerScript) {
      injectScripts(footerScript, document.body)
    }

    // Sin cleanup estricto para no romper widgets de terceros.
  }, [headScript, footerScript])
}
