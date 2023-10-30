import { describe, expect, it } from "@jest/globals";
import type * as RDF from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';
import type { MultiBucketizerOptions } from '../lib/MultiBucketizer';
import { MultiBucketizerFactory } from '../lib/MultiBucketizer';
import * as N3 from 'n3';
import { FactoryBuilder } from '@treecg/bucketizer-core';
import { BasicBucketizerFactory, BasicInputType } from '@treecg/basic-bucketizer';
import { SubjectInputType, SubjectPageBucketizerFactory } from '@treecg/subject-page-bucketizer';

describe('bucketizer-multi', () => {
  const factory: RDF.DataFactory = new DataFactory();

  const small_factory = FactoryBuilder.builder().add(new BasicBucketizerFactory()).add(new SubjectPageBucketizerFactory());

  it('should add members to the same page when it is not full', async () => {
    const config: MultiBucketizerOptions<{} | SubjectInputType | BasicInputType> = {
      configs: [
        {
          "type": "basic", "config": {
            "bucketProperty": "test",
            "propertyPath": "<pred1>",
            "pageSize": 3,
          }
        }, {
          "type": "subject", "config": {
            "bucketProperty": "test",
            "propertyPath": "<pred2>",
            "pageSize": 1,
          }
        }, {
          "type": "subject", "config": {
            "bucketProperty": "test",
            "propertyPath": "<pred3>",
            "pageSize": 1,
          }
        }
      ]
    };
    const f = new MultiBucketizerFactory(small_factory);
    const bucketizer = f.build(config);

    const quadsArray: string[] = [];
    const extrasArray: string[] = [];

    for (let i = 0; i < 4; i++) {
      const id = 'p1' + i;
      const quads = [
        factory.quad(factory.namedNode(id), factory.namedNode("pred1"), factory.literal("v1")),
        factory.quad(factory.namedNode(id), factory.namedNode("pred2"), factory.literal("v2")),
        factory.quad(factory.namedNode(id), factory.namedNode("pred3"), factory.literal("v3")),
      ];
      const extras = bucketizer.bucketize(quads, id);
      quadsArray.push(new N3.Writer().quadsToString(quads));
      extrasArray.push(new N3.Writer().quadsToString(extras));
    }

    for (let i = 0; i < 4; i++) {
      const id = 'p2' + i;
      const quads = [
        factory.quad(factory.namedNode(id), factory.namedNode("pred1"), factory.literal("v1")),
        factory.quad(factory.namedNode(id), factory.namedNode("pred2"), factory.literal("v21")),
        factory.quad(factory.namedNode(id), factory.namedNode("pred3"), factory.literal("v3")),
      ];
      const extras = bucketizer.bucketize(quads, id);
      quadsArray.push(new N3.Writer().quadsToString(quads));
      extrasArray.push(new N3.Writer().quadsToString(extras));
    }

    // for (let i = 0; i < quadsArray.length; i++) {
    //   console.log("---------- ", i, " --------------\n", quadsArray[i], "\n", extrasArray[i]);
    // }

    // throw "Nope"
  });

  it("Parse ld correctly", () => {
    const ld = `
@prefix ex: <http://example.org/ns#> .
@prefix ldes: <https://w3id.org/ldes#> .
@prefix tree: <https://w3id.org/tree#> .

ex:MultiBucketizeStrategy a ldes:BucketizeStrategy;
  ldes:bucketType ldes:multi;
  ldes:configs (
    ex:BucketizeStrategy
    ex:BucketizeStrategy
  ) .

ex:BucketizeStrategy
    ldes:bucketType ldes:subject;
    ldes:bucketProperty ldes:bucket2;
    tree:path ex:x;
    ldes:pageSize 2.
    `;
    const quads = new N3.Parser().parse(ld);
    const f = new MultiBucketizerFactory(small_factory);
    const c = f.ldConfig(quads, factory.namedNode("http://example.org/ns#MultiBucketizeStrategy"));

    expect(c).not.toBeUndefined()
  });

});

