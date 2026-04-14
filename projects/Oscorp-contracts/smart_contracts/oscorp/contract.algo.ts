import { Contract } from '@algorandfoundation/algorand-typescript'

export class Oscorp extends Contract {
  hello(name: string): string {
    return `Hello, ${name}`
  }
}
