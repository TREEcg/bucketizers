import type * as RDF from '@rdfjs/types';
import { Factory, FactoryBuilder, findProperty } from '@treecg/bucketizer-core';
import { Bucketizer, SDS, LDES, RDF as RDFT } from '@treecg/types';
import { DataFactory } from 'rdf-data-factory';
import { Quad_Object, Quad_Subject } from '@rdfjs/types';

export interface MultiBucketizerOptions<C> {
  configs: { config: C, type: string }[];
};

export class MultiBucketizerFactory<C> implements Factory<MultiBucketizerOptions<C>> {
  type: string = "multi";

  private readonly factory: FactoryBuilder<C>;
  constructor(factory: FactoryBuilder<C>) {
    this.factory = factory;
  }
  build(config: MultiBucketizerOptions<C>, state?: any): Bucketizer {
    return MultiBucketizer.build(config, this.factory, state)
  }

  ldConfig(quads: RDF.Quad[], subject: RDF.Term): MultiBucketizerOptions<C> | void {
    if (findProperty(quads, subject, LDES.terms.bucketType).value !== LDES.custom(this.type)) {
      return;
    }

    const configs: { config: C, type: string }[] = [];
    let current = findProperty(quads, subject, LDES.terms.custom("configs"));
    try {
      while (current.value !== RDFT.nil) {
        // Find current config
        const currentSubject = findProperty(quads, current, RDFT.terms.first);
        configs.push(this.factory.getConfig(quads, currentSubject));

        // Find next current
        current = findProperty(quads, current, RDFT.terms.rest);
      }
    } catch (ex: any) {
      // This is fine
    }

    return { configs };
  }
}

type Bucketizers = { current: Bucketizer, root?: RDF.Term, children: { [bucket: string]: Bucketizers } };

export class MultiBucketizer implements Bucketizer {
  builders: (() => Bucketizer)[] = [];
  bucketizers: Bucketizers;
  protected readonly factory: RDF.DataFactory = new DataFactory();

  private constructor() {

  }

  public static build<C>(config: MultiBucketizerOptions<C>, factory: FactoryBuilder<C>, _state?: any): MultiBucketizer {
    const out = new MultiBucketizer();

    for (let c of config.configs) {
      out.builders.push(() => factory.build(c.config, c.type));
    }

    out.bucketizers = { current: out.builders[0](), children: {} };
    return out;
  }

  bucketize(quads: RDF.Quad[], memberId: string): RDF.Quad[] {
    return this.bucketizePart(quads, memberId, this.bucketizers, this.builders.slice(1));
  }

  extractBucketId(quads: RDF.Quad[], memberId: string): RDF.Term {
    let sdsRecordId = quads.find(x => x.predicate.value === SDS.payload && x.object.value === memberId)?.subject;
    if (!sdsRecordId) {
      throw "Expected a SDS record";
    }

    let bucketId = quads.find(x => x.subject.equals(sdsRecordId) && x.predicate.value === SDS.bucket)?.object;
    if (!bucketId) {
      throw "Expected a Bucket value";
    }
    return bucketId;
  }

  bucketizePart(quads: RDF.Quad[], memberId: string, bucketizers: Bucketizers, builders: (() => Bucketizer)[]): RDF.Quad[] {
    let extras = bucketizers.current.bucketize(quads, memberId);

    // Recursion!
    if (builders.length > 0) {
      // Find target bucket
      const bucketId = this.extractBucketId(extras, memberId);
      const bucketValue = bucketId.value;

      if (!bucketizers.children[bucketId.value]) {
        bucketizers.children[bucketId.value] = { current: builders[0](), children: {} };
      }

      const laterExtras = this.bucketizePart(quads, memberId, bucketizers.children[bucketId.value], builders.slice(1));

      // Try update our information about root buckets 
      const root = laterExtras.find(x => x.predicate.value === SDS.custom("isRoot") && x.object.value === "true")?.subject;
      if (root) {
        bucketizers.children[bucketId.value].root = root;
      }

      // Reactively rewrite everything :(
      const extraBuckets = [
        this.extractBucketId(laterExtras, memberId),
        ...laterExtras
          .filter(x => x.predicate.value === SDS.relation)
          .flatMap(x => [x.subject, laterExtras.find(q => q.subject.equals(x.object) && q.predicate.value === SDS.relationBucket)!.object])
      ];


      if (extraBuckets.some(x => x.termType !== "NamedNode")) {
        console.error("Actually I only want named nodes here");
      }

      //  REMOVE MY SHITTY SDS RECORD
      const recordId = extras.find(x => x.predicate.value === SDS.payload && x.object.value === memberId)!.subject;
      extras = extras.filter(x => !x.subject.equals(recordId));

      const mapTerm = (x: RDF.Term) => {
        const isRoot = x.equals(bucketizers.children[bucketValue].root);
        if(isRoot) {
          return bucketId;
        }

        const matched = extraBuckets.find(q => q.equals(x));
        if (matched) {
          switch (x.termType) {
            case "NamedNode":
              return this.factory.namedNode(bucketValue + '/' + x.value);
            case "BlankNode":
              return this.factory.blankNode(bucketValue + '/' + x.value);
          }
          throw "Expected only NamedNode or BlankNode to be mapped";
        } else {
          return x;
        }
      };

      extras.push(
        ...laterExtras.filter(x => !x.predicate.equals(SDS.terms.custom("isRoot"))).map(q => this.factory.quad(
          <Quad_Subject>mapTerm(q.subject),
          q.predicate,
          <Quad_Object>mapTerm(q.object),
          q.graph
        ))

      )
    }

    return extras;
  }

  importState(_state: any): void {

  };
  exportState() {
  };
}
