import { describe, expect, test } from "@jest/globals";
import { BasicBucketizer } from '@treecg/basic-bucketizer';
import { GeospatialBucketizer } from '@treecg/geospatial-bucketizer';
import { SubjectPageBucketizer } from '@treecg/subject-page-bucketizer';
import { SubstringBucketizer } from '@treecg/substring-bucketizer';
import type { Bucketizer } from '@treecg/types';
import * as N3 from 'n3';
import { createBucketizer, createBucketizerLD, getValidShape } from '..';

describe('bucketizers-factory', () => {
  test('adds 1 + 2 to equal 3', () => {
    expect(1 + 2).toBe(3);
  });

  test('creating basic bucketizer with config works', () => {
    let bucketizer,
        err;
    try {
      bucketizer = createBucketizer({ type: 'basic', propertyPath: '<something>' });
    } catch (error) {
      err = error;
    }

    expect(bucketizer).not.toBeUndefined();
    expect(err).toBeUndefined();
    expect(bucketizer).toBeInstanceOf(BasicBucketizer);
  });

  test('creating bucketizer with false config does not works', () => {
    let bucketizer,
        err;
    try {
      bucketizer = createBucketizer(<any>{ type: 'nothing' });
    } catch (error) {
      err = error;
    }

    expect(bucketizer).toBeUndefined();
    expect(err).not.toBeUndefined();
  });

  describe('basic bucketizer', () => {
    const rdf = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:basic;
            ldes:bucketProperty ldes:bucket;
            ldes:pageSize 50.
        `;

    test('config is valid', async () => {
      const quads = new N3.Parser().parse(rdf);
      const result = await getValidShape(quads);
      expect(result).not.toBeUndefined();
    });

    test('parses from linked data', async () => {
      const quads = new N3.Parser().parse(rdf);

      let bucketizer: Bucketizer | undefined,
          err;
      try {
        bucketizer = await createBucketizerLD(quads);
      } catch (error: any) {
        console.log(error.stack);
        err = error;
      }

      expect(bucketizer).not.toBeUndefined();
      expect(err).toBeUndefined();
      expect(bucketizer).toBeInstanceOf(BasicBucketizer);
    });
  });

  describe('subject bucketizer', () => {
    const rdf = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:subject;
            ldes:bucketProperty ldes:bucket;
            tree:path ldes:Bucket2;
            ldes:pageSize 50.
        `;

    test('config is valid', async () => {
      const quads = new N3.Parser().parse(rdf);
      expect(await getValidShape(quads)).not.toBeUndefined();
    });

    test('parses from linked data', async () => {
      console.log("parse from ld");
      const quads = new N3.Parser().parse(rdf);

      let bucketizer: Bucketizer | undefined,
          err;
      try {
        bucketizer = await createBucketizerLD(quads);
      } catch (error: any) {
        console.log(error);
        console.log(error.stack);
        err = error;
      }

      expect(bucketizer).not.toBeUndefined();
      expect(err).toBeUndefined();
      expect(bucketizer).toBeInstanceOf(SubjectPageBucketizer);

      const state = bucketizer!.exportState();
      expect(state.propertyPathPredicates).toHaveLength(1);
    });

    const rdfPath = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:subject;
            ldes:bucketProperty ldes:bucket;
            tree:path (ex:point ex:x);
            ldes:pageSize 50.
        `;

    test('can have property path', async () => {
      const quads = new N3.Parser().parse(rdfPath);

      let bucketizer: Bucketizer | undefined,
          err;
      try {
        bucketizer = await createBucketizerLD(quads);
      } catch (error: any) {
        console.log(error.stack);
        err = error;
      }

      expect(bucketizer).not.toBeUndefined();
      expect(err).toBeUndefined();
      expect(bucketizer).toBeInstanceOf(SubjectPageBucketizer);

      const state = bucketizer!.exportState();
      expect(state.propertyPathPredicates).toHaveLength(2);
    });
  });

  describe('substring bucketizer', () => {
    const rdf = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:substring;
            ldes:bucketProperty ldes:bucket;
            tree:path ldes:Bucket2;
            ldes:pageSize 50.
        `;

    test('config is valid', async () => {
      const quads = new N3.Parser().parse(rdf);
      expect(await getValidShape(quads)).not.toBeUndefined();
    });

    test('parses from linked data', async () => {
      const quads = new N3.Parser().parse(rdf);

      let bucketizer: Bucketizer | undefined,
          err;
      try {
        bucketizer = await createBucketizerLD(quads);
      } catch (error: any) {
        console.log(error.stack);
        err = error;
      }

      expect(bucketizer).not.toBeUndefined();
      expect(err).toBeUndefined();
      expect(bucketizer).toBeInstanceOf(SubstringBucketizer);

      const state = bucketizer!.exportState();
      expect(state.propertyPathPredicates).toHaveLength(1);
    });
  });

  describe('geospatial bucketizer', () => {
    const rdf = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:geospatial;
            ldes:bucketProperty ldes:bucket;
            tree:path ldes:Bucket2;
            ldes:zoomLevel 2;
            ldes:pageSize 50.
        `;

    test('config is valid', async () => {
      const quads = new N3.Parser().parse(rdf);
      expect(await getValidShape(quads)).not.toBeUndefined();
    });

    test('parses from linked data', async () => {
      const quads = new N3.Parser().parse(rdf);

      let bucketizer: Bucketizer | undefined,
          err;
      try {
        bucketizer = await createBucketizerLD(quads);
      } catch (error: any) {
        console.log(error);
        console.log(error.stack);
        err = error;
      }

      expect(bucketizer).not.toBeUndefined();
      expect(err).toBeUndefined();
      expect(bucketizer).toBeInstanceOf(GeospatialBucketizer);

      const state = bucketizer!.exportState();
      expect(state.propertyPathPredicates).toHaveLength(1);
    });
  });

  test('invalid type gets flagged by shacl', async () => {
    const rdf = `
        @prefix ex: <https://example.org/ns#> .
        @prefix ldes: <https://w3id.org/ldes#> .
        @prefix tree: <https://w3id.org/tree#> .

        ex:BucketizeStrategy a ldes:BucketizeStrategy;
            ldes:bucketType ldes:something;
            ldes:pageSize 50.
        `;

    const quads = new N3.Parser().parse(rdf);
    expect(await getValidShape(quads)).toBeUndefined();

    let bucketizer: Bucketizer | undefined,
        err;
    try {
      bucketizer = await createBucketizerLD(quads);
    } catch (error: any) {
      console.log(error.stack);
      err = error;
    }

    expect(bucketizer).toBeUndefined();
    expect(err).not.toBeUndefined();
  });
});
