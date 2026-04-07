import {wcagContrastChecker} from '@mdhnpm/wcag-contrast-checker'
import {Badge, Box, Card, Flex, Inline, Label, Stack, Text, TextInput} from '@sanity/ui'
import namer from 'color-namer'
import {
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {HexColorPicker} from 'react-colorful'
import {type ObjectInputProps, set, unset} from 'sanity'

type ContrastTone = 'positive' | 'critical'

type ContrastResult = {
  regularAA: ContrastTone
  regularAAA: ContrastTone
  largeAA: ContrastTone
  largeAAA: ContrastTone
}

type RgbColour = {r: number; g: number; b: number}
type HslColour = {h: number; s: number; l: number}
type HsvColour = {h: number; s: number; v: number}
type AccessibleColourValue = {
  hex?: string
  rgb?: RgbColour
  hsl?: HslColour
  hsv?: HsvColour
  swatchName?: string
}

const HEX_COLOUR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

const getOptions = (
  schemaType: ObjectInputProps['schemaType'],
): {
  compareColour?: string
  defaultColour?: string
  swatchName?: string
  showSwatchName: boolean
} => {
  const options = (schemaType.options ?? {}) as {
    compareColour?: string
    'compare-colour'?: string
    defaultColour?: string
    swatchName?: string
    'swatch-name'?: string
    showSwatchName?: boolean
    'show-swatch-name'?: boolean
  }

  return {
    compareColour: options.compareColour ?? options['compare-colour'],
    defaultColour: options.defaultColour,
    swatchName: options.swatchName ?? options['swatch-name'],
    showSwatchName: options.showSwatchName ?? options['show-swatch-name'] ?? true,
  }
}

const toContrastResult = (compareColour: string, colour: string): ContrastResult => {
  const contrast = wcagContrastChecker(compareColour, colour)

  return {
    regularAA: contrast.regularText.aa ? 'positive' : 'critical',
    regularAAA: contrast.regularText.aaa ? 'positive' : 'critical',
    largeAA: contrast.largeText.aa ? 'positive' : 'critical',
    largeAAA: contrast.largeText.aaa ? 'positive' : 'critical',
  }
}

const expandHex = (hex: string) => {
  const value = hex.replace('#', '')
  if (value.length === 3) {
    return value
      .split('')
      .map((char) => char + char)
      .join('')
  }

  return value
}

const hexToRgb = (hex: string): RgbColour => {
  const expandedHex = expandHex(hex)
  return {
    r: Number.parseInt(expandedHex.slice(0, 2), 16),
    g: Number.parseInt(expandedHex.slice(2, 4), 16),
    b: Number.parseInt(expandedHex.slice(4, 6), 16),
  }
}

const rgbToHsv = ({r, g, b}: RgbColour): HsvColour => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6
    } else if (max === gn) {
      h = (bn - rn) / delta + 2
    } else {
      h = (rn - gn) / delta + 4
    }
  }

  const hue = Math.round((h * 60 + 360) % 360)
  const saturation = max === 0 ? 0 : Math.round((delta / max) * 100)
  const value = Math.round(max * 100)

  return {h: hue, s: saturation, v: value}
}

const rgbToHsl = ({r, g, b}: RgbColour): HslColour => {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  let s = 0

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))

    if (max === rn) {
      h = ((gn - bn) / delta) % 6
    } else if (max === gn) {
      h = (bn - rn) / delta + 2
    } else {
      h = (rn - gn) / delta + 4
    }
  }

  return {
    h: Math.round((h * 60 + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

const toColourValue = (hex: string, swatchName?: string): AccessibleColourValue => {
  const rgb = hexToRgb(hex)
  return {
    hex,
    rgb,
    hsl: rgbToHsl(rgb),
    hsv: rgbToHsv(rgb),
    swatchName,
  }
}

export function AccessibleColourInput(props: ObjectInputProps): ReactElement {
  const {onChange, value, schemaType, elementProps} = props
  const pickerWrapperRef = useRef<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const {compareColour, defaultColour, swatchName, showSwatchName} = useMemo(
    () => getOptions(schemaType),
    [schemaType],
  )
  const colourValue = value as AccessibleColourValue | undefined
  const colour = colourValue?.hex ?? defaultColour ?? '#ffffff'
  const currentHex = colourValue?.hex
  const storedSwatchName = colourValue?.swatchName ?? ''
  const pickerColour = HEX_COLOUR_PATTERN.test(colour) ? colour : '#ffffff'

  useEffect(() => {
    const closePickerOnOutsideClick = (event: MouseEvent) => {
      if (!pickerWrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', closePickerOnOutsideClick)
    return () => document.removeEventListener('mousedown', closePickerOnOutsideClick)
  }, [])

  const contrastResult = useMemo(() => {
    if (
      !compareColour ||
      !HEX_COLOUR_PATTERN.test(compareColour) ||
      !HEX_COLOUR_PATTERN.test(colour)
    ) {
      return null
    }

    return toContrastResult(compareColour, colour)
  }, [colour, compareColour])

  const colourName = useMemo(() => {
    if (!HEX_COLOUR_PATTERN.test(colour)) {
      return ''
    }

    const namedColour = namer(colour).ntc[0]?.name
    return namedColour ? titleCase(namedColour) : ''
  }, [colour])
  const swatchNamePlaceholder = swatchName || colourName || colour
  const swatchLabel = storedSwatchName || swatchNamePlaceholder

  const handleChange = useCallback(
    (nextValue: string) => {
      if (nextValue.length === 0) {
        onChange(unset())
        return
      }

      if (!HEX_COLOUR_PATTERN.test(nextValue)) {
        onChange(set({hex: nextValue, swatchName: storedSwatchName}))
        return
      }

      onChange(set(toColourValue(nextValue, storedSwatchName)))
    },
    [onChange, storedSwatchName],
  )

  const togglePicker = useCallback(() => {
    setIsOpen((open) => !open)
  }, [])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      handleChange(event.currentTarget.value)
    },
    [handleChange],
  )

  const handleSwatchClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      togglePicker()
    },
    [togglePicker],
  )

  const handleSwatchNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextSwatchName = event.currentTarget.value
      if (!currentHex) {
        onChange(set({swatchName: nextSwatchName}))
        return
      }

      if (!HEX_COLOUR_PATTERN.test(currentHex)) {
        onChange(set({hex: currentHex, swatchName: nextSwatchName}))
        return
      }

      onChange(set(toColourValue(currentHex, nextSwatchName)))
    },
    [currentHex, onChange],
  )

  return (
    <Stack space={3}>
      {contrastResult && (
        <Card padding={3} radius={2} tone={'transparent'}>
          <Stack space={2}>
            <Label size={1}>WCAG compliance results</Label>
            <Inline space={2}>
              <Badge tone={contrastResult.regularAA}>AA regular</Badge>
              <Badge tone={contrastResult.largeAA}>AA large</Badge>
              <Badge tone={contrastResult.regularAAA}>AAA regular</Badge>
              <Badge tone={contrastResult.largeAAA}>AAA large</Badge>
            </Inline>
            <Text size={1} muted>
              Compared against {compareColour}
            </Text>
          </Stack>
        </Card>
      )}

      <Flex align={'center'} gap={3}>
        <Box style={{position: 'relative'}} ref={pickerWrapperRef}>
          <button
            type={'button'}
            aria-label={`Toggle colour picker for ${swatchLabel}`}
            aria-expanded={isOpen}
            aria-controls={isOpen ? 'accessible-colour-picker' : undefined}
            title={swatchLabel}
            onClick={handleSwatchClick}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--card-border-color)',
              backgroundColor: pickerColour,
              cursor: 'pointer',
            }}
          />
          {isOpen && (
            <Card
              id={'accessible-colour-picker'}
              padding={2}
              radius={2}
              shadow={2}
              style={{position: 'absolute', top: '3rem', zIndex: 10}}
            >
              <HexColorPicker color={pickerColour} onChange={handleChange} />
            </Card>
          )}
        </Box>

        <Box flex={1}>
          <TextInput
            {...elementProps}
            value={colour}
            onChange={handleInputChange}
            aria-label={'Hex colour'}
            // style={{
            //   width: '100%',
            //   border: '1px solid var(--card-border-color)',
            //   borderRadius: '0.375rem',
            //   padding: '0.625rem 0.75rem',
            //   fontSize: '0.875rem',
            // }}
          />
        </Box>
      </Flex>

      {showSwatchName && (
        <TextInput
          value={storedSwatchName}
          onChange={handleSwatchNameChange}
          placeholder={swatchNamePlaceholder}
          aria-label={'Swatch name'}
        />
      )}

    </Stack>
  )
}
