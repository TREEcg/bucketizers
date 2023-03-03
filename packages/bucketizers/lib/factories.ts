import { FactoryBuilder } from "@treecg/bucketizer-core";
import { BucketizerCoreExtOptions, BucketizerCoreOptions } from "@treecg/types";
import { MultiBucketizerFactory, MultiBucketizerOptions, BasicBucketizerFactory, GeospatialBucketizerFactory, SubjectPageBucketizerFactory, SubstringBucketizerFactory } from "..";

export type SmallConfigs = {} | BucketizerCoreOptions | BucketizerCoreExtOptions | BucketizerCoreExtOptions & {'zoom': number};
export type Configs =  SmallConfigs | MultiBucketizerOptions<SmallConfigs>;
export const small_factory: FactoryBuilder<SmallConfigs> = FactoryBuilder.builder().add(new BasicBucketizerFactory()).add(new GeospatialBucketizerFactory()).add(new SubjectPageBucketizerFactory()).add(new SubstringBucketizerFactory());
export const FACTORY: FactoryBuilder<Configs> = small_factory.add(new MultiBucketizerFactory(small_factory));
