#!/usr/bin/perl
use strict;
use warnings;

open my $fh, '<', 'files_to_migrate.txt' or die "Could not open files_to_migrate.txt: $!";
my @files = <$fh>;
chomp @files;
close $fh;

foreach my $file (@files) {
    next unless -f $file;
    
    # Read file content
    open my $ifh, '<', $file or next;
    my $content = do { local $/; <$ifh> };
    close $ifh;
    
    my $original = $content;

    # Shadow replacements
    $content =~ s/shadow-\[0_24px_64px_rgba\(0,0,0,0\.45\)\]/shadow-popover/g;
    $content =~ s/shadow-\[0_24px_80px_rgba\(0,0,0,0\.45\)\]/shadow-modal/g;
    $content =~ s/shadow-\[0_8px_24px_rgba\(0,0,0,0\.35\)\]/shadow-popover/g;
    $content =~ s/shadow-\[inset_0_0_0_1px_rgba\(255,255,255,0\.05\)\]/shadow-glow/g;
    $content =~ s/shadow-\[inset_0_0_0_1px_rgba\(255,255,255,0\.03\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_0_1px_rgba\(255,255,255,0\.03\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_15px_rgba\(255,255,255,0\.05\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_20px_rgba\(255,255,255,0\.1\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_30px_rgba\(255,255,255,0\.05\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_30px_rgba\(255,255,255,0\.2\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_0_1px_rgba\(255,255,255,0\.02\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_0_1px_rgba\(255,255,255,0\.08\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_30px_rgba\(191,90,242,0\.15\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_30px_rgba\(41,151,255,0\.15\)\]/shadow-glow/g;
    $content =~ s/shadow-\[0_0_30px_rgba\(48,209,88,0\.15\)\]/shadow-glow/g;
    $content =~ s/shadow-\[inset_0_0_0_1px_rgba\(91,138,245,0\.18\)\]/shadow-glow/g;

    # Rounded replacements
    $content =~ s/rounded-(3xl|2xl|xl)\b/rounded-panel/g;
    $content =~ s/rounded-lg\b/rounded-card/g;
    $content =~ s/rounded-(md|sm)\b/rounded-item/g;
    $content =~ s/(?<![-])\brounded\b(?![-\[])/rounded-item/g;
    
    $content =~ s/rounded-\[(\d+)px\]/
        my $px = $1;
        if ($px >= 12) { "rounded-panel" }
        elsif ($px >= 8) { "rounded-card" }
        else { "rounded-item" }
    /ge;

    if ($content ne $original) {
        open my $ofh, '>', $file or next;
        print $ofh $content;
        close $ofh;
        print "Migrated: $file\n";
    }
}
