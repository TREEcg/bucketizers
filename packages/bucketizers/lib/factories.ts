import { FactoryBuilder } from "@treecg/bucketizer-core";
import { BucketizerCoreExtOptions, BucketizerCoreOptions } from "@treecg/types";
import { MultiBucketizerFactory, MultiBucketizerOptions, BasicBucketizerFactory, GeospatialBucketizerFactory, SubjectPageBucketizerFactory, SubstringBucketizerFactory } from "..";

export type Configs = {} | BucketizerCoreOptions | BucketizerCoreExtOptions | BucketizerCoreExtOptions & {'zoom': number} | MultiBucketizerOptions;
export const FACTORY: FactoryBuilder<Configs> = FactoryBuilder.builder().add(new BasicBucketizerFactory()).add(new GeospatialBucketizerFactory()).add(new SubjectPageBucketizerFactory()).add(new SubstringBucketizerFactory()).add(new MultiBucketizerFactory());
