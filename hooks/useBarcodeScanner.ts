import { useRef, useEffect } from 'react'
import type { RefObject } from 'react'

export function useBarcodeScanner(
  onBarcode: (code: string) => void,
  excludeRef?: RefObject<HTMLInputElement | null>,
) {
  const cbRef = useRef(onBarcode)
  cbRef.current = onBarcode

  const bufferRef = useRef<string[]>([])
  const timesRef  = useRef<number[]>([])
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (excludeRef?.current && document.activeElement === excludeRef.current) return
      if (e.ctrlKey || e.altKey || e.metaKey) return

      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current)
        const code  = bufferRef.current.join('')
        const times = timesRef.current
        bufferRef.current = []
        timesRef.current  = []
        if (code.length >= 4 && times.length >= 2) {
          const span = times[times.length - 1] - times[0]
          if (span < 100) cbRef.current(code)
        }
        return
      }

      if (e.key.length !== 1) return
      bufferRef.current.push(e.key)
      timesRef.current.push(Date.now())
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        bufferRef.current = []
        timesRef.current  = []
      }, 150)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [excludeRef])
}
