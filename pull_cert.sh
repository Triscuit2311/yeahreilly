#!/bin/bash

gcloud auth login
gcloud config set project yeaheilly-signing
gcloud secrets versions access latest --secret=signing-pem > key.pem
