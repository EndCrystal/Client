export class Block {
  name: string
  attributes: attribute

  constructor(name: string, attributes: attribute) {
    this.name = name
    this.attributes = attributes
  }

  hasAux(): boolean {
    return (this.attributes & attribute.has_aux) != 0
  }
  hasColor(): boolean {
    return (this.attributes & attribute.has_color) != 0
  }
  isSolid(): boolean {
    return (this.attributes & attribute.solid) != 0
  }
  isFluid(): boolean {
    return (this.attributes & attribute.fluid) != 0
  }
}

export class BlockInstance {
  block: Block
  aux: number
  color: number
}

export enum attribute {
  none = 0,
  has_aux = 1 << 0,
  has_color = 1 << 1,
  solid = 1 << 2,
  fluid = 1 << 3,
}

export class BlockRegistry {
  private registry: Block[] = []
  private index = new Map<string, Block>()

  register(name: string, attributes: attribute) {
    const obj = new Block(name, attributes)
    this.registry.push(obj)
    this.index.set(name, obj)
  }

  getByName(name: string): Block | undefined {
    return this.index.get(name)
  }
}
