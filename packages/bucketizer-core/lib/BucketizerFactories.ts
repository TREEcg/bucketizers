import { Bucketizer } from "@treecg/types";
import { Quad, Term } from "@rdfjs/types";

export interface Typed<C> {
  type: string;
  config: C;
};

export interface Factory<C> {
  type: string;
  build(config: C, state?: any): Bucketizer;
  ldConfig(quads: Quad[], subject: Term): C | void;
}

export class FactoryBuilder<C> {
  private readonly factories: Factory<C>[];
  private constructor(factories: Factory<C>[]) {
    this.factories = factories;
  }

  static builder(): FactoryBuilder<{}> {
    return new FactoryBuilder([]);
  }

  add<N>(factory: Factory<N>): FactoryBuilder<C | N> {
    const nInner = <Factory<C | N>[]>this.factories;
    nInner.push(factory);
    return new FactoryBuilder(nInner);
  }

  build(config: C, type: string, state?: any): Bucketizer {
    for (let f of this.factories) {
      if (f.type.toLowerCase() === type.toLowerCase()) {
        return f.build(config, state)
      }
    }

    throw "No such factory found! " + type;
  }

  getConfig(quads: Quad[], subject: Term): { config: C, type: string } {
    for (let f of this.factories) {
      try {
        const config = f.ldConfig(quads, subject);
        if (config) {
          return { config, type: f.type };
        }
      } catch (e: any) {
        console.log(e);

      }
    }

    throw "No such factory found!";
  }


  buildLD(quads: Quad[], subject: Term, state?: any): Bucketizer {
    for (let f of this.factories) {
      try {
        const config = f.ldConfig(quads, subject);
        if (config) {
          return f.build(config, state);
        }
      } catch (e: any) {

      }
    }

    throw "No such factory found! Tried " + this.factories.map(f => f.type).join(', ');
  }
}

