import type * as RDF from '@rdfjs/types';
import { SDS } from '@treecg/types';
import { DataFactory } from 'rdf-data-factory';
import type { MultiBucketizerOptions } from '../lib/MultiBucketizer';
import { MultiBucketizerFactory } from '../lib/MultiBucketizer';
import * as N3 from 'n3';

describe('bucketizer-multi', () => {
  const factory: RDF.DataFactory = new DataFactory();

  it('should add members to the same page when it is not full', async () => {
    const config: MultiBucketizerOptions = {
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
    const f = new MultiBucketizerFactory();
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

    for (let i = 0; i < quadsArray.length; i++) {
      console.log("---------- ", i, " --------------\n", quadsArray[i], "\n", extrasArray[i]);
    }

    throw "Nope"
  });

});

